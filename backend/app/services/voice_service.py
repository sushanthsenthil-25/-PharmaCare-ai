import re
from datetime import date, datetime, time, timezone
from typing import Optional, Dict, Any, Tuple
from fastapi import HTTPException, status

from app.models.ai import VoiceCommand
from app.models.product import Product
from app.models.inventory import Inventory, Batch
from app.models.transaction import Sale
from app.db.mongodb import to_oid
from app.schemas.voice import VoiceProcessRequest, VoiceResponse, VoiceConfirmRequest
from app.services.sales_service import create_sale
from app.schemas.transaction import SaleCreate, SaleItemCreate
from app.services.audit_service import record_audit_log


def detect_language_and_intent(transcript: str) -> Tuple[str, str, Dict[str, Any]]:
    """
    Detects language (English, Tamil, Tanglish) and extracts intent and entities.
    Examples:
    - 'Paracetamol stock evlo irukku?' -> Tanglish, CHECK_STOCK
    - 'Paracetamol 10 piece sell pannunga' -> Tanglish, CREATE_SALE
    - 'How many Paracetamol are available?' -> English, CHECK_STOCK
    - 'Sell 5 Amoxicillin' -> English, CREATE_SALE
    - 'பரசிட்டமால் இருப்பு எவ்வளவு?' -> Tamil, CHECK_STOCK
    """
    t = transcript.strip()
    lower = t.lower()

    # Detect Tamil characters
    has_tamil_script = any('\u0b80' <= c <= '\u0bff' for c in t)
    # Detect Tanglish markers
    tanglish_markers = [
        "evlo", "irukku", "pannunga", "kudu", "iruka", "venum", "edunga", "kodu", "enna",
        "stock evlo", "sell pannunga", "bill pannunga", "ethana", "piece"
    ]
    is_tanglish = any(m in lower for m in tanglish_markers)

    if has_tamil_script:
        language = "ta"
    elif is_tanglish:
        language = "tanglish"
    else:
        language = "en"

    # Intent & Entity Detection

    # 1. CREATE_SALE (Write action)
    sale_match = (
        re.search(r'([a-zA-Z0-9\s]+?)\s+(\d+)\s*(?:piece|pieces|unit|units|strip|strips|tablets)?\s*(?:sell pannunga|bill pannunga|kudunga|kodu|dispense)', lower)
        or re.search(r'(?:sell|bill|dispense)\s+(\d+)\s*(?:piece|pieces|unit|units|strip|strips)?\s*(?:of\s+)?([a-zA-Z0-9\s]+)', lower)
        or re.search(r'(\d+)\s+([a-zA-Z0-9\s]+?)\s*(?:sell pannunga|bill pannunga)', lower)
    )

    if sale_match:
        g1 = sale_match.group(1).strip()
        g2 = sale_match.group(2).strip()
        if g1.isdigit():
            qty = int(g1)
            prod_name = g2
        elif g2.isdigit():
            qty = int(g2)
            prod_name = g1
        else:
            qty = 1
            prod_name = g1

        prod_name = re.sub(r'\b(sell|bill|piece|pieces|strip|strips|pannunga|kudunga)\b', '', prod_name).strip()
        return language, "CREATE_SALE", {"product_name": prod_name, "qty": qty}

    # 2. CHECK_STOCK (Read action)
    stock_match = (
        re.search(r'([a-zA-Z0-9\s]+?)\s*(?:stock\s+evlo\s+irukku|stock\s+iruka|evlo\s+irukku|stock|irukku)', lower)
        or re.search(r'(?:how many|check stock of|stock of|quantity of)\s*([a-zA-Z0-9\s]+)', lower)
    )

    if stock_match:
        prod_name = stock_match.group(1).strip()
        prod_name = re.sub(r'\b(stock|evlo|irukku|iruka|of|check|how|many)\b', '', prod_name).strip()
        if prod_name:
            return language, "CHECK_STOCK", {"product_name": prod_name}

    # 3. GET_LOW_STOCK
    if any(k in lower for k in ["low stock", "kammi", "kuraivaaga", "running out"]):
        return language, "GET_LOW_STOCK", {}

    # 4. GET_TODAY_SALES
    if any(k in lower for k in ["today sales", "innaiku sales", "sales today", "innikku vyabaram"]):
        return language, "GET_TODAY_SALES", {}

    # 5. GET_ALERTS
    if any(k in lower for k in ["alert", "warning", "eccarikkai"]):
        return language, "GET_ALERTS", {}

    return language, "UNKNOWN", {"raw_text": t}


async def process_voice_command(
    business_id: str,
    user_id: str,
    branch_id: Optional[str],
    req: VoiceProcessRequest,
    db=None,
) -> VoiceResponse:
    # 1. Transcript resolution (STT fallback to command_text)
    transcript = req.command_text or "Check stock"
    language, intent, entities = detect_language_and_intent(transcript)

    # 2. Permission / Safety validation
    is_write = (intent == "CREATE_SALE")
    action_type = "WRITE" if is_write else "READ"

    # Command record
    cmd = VoiceCommand(
        user_id=user_id,
        business_id=business_id,
        transcript=transcript,
        language=language,
        intent=intent,
        entities=entities,
        action_type=action_type,
        confirmed=False if is_write else True,
        execution_status="PENDING" if is_write else "EXECUTED",
    )
    await cmd.insert()

    # 3. Handle READ actions (Execute immediately)
    if not is_write:
        if intent == "CHECK_STOCK":
            pname = entities.get("product_name", "")
            products = await Product.find(Product.business_id == business_id).to_list()
            matched_products = [p for p in products if pname.lower() in p.name.lower()]
            
            if matched_products:
                p = matched_products[0]
                invs = await Inventory.find(Inventory.product_id == str(p.id)).to_list()
                q = sum(inv.qty_on_hand for inv in invs)
                
                if language in ["tanglish", "ta"]:
                    tts = f"{p.name} kitta {q} piece stock irukku. Price ₹{p.selling_price}."
                else:
                    tts = f"There are {q} units of {p.name} available in stock at ₹{p.selling_price} each."

                cmd.result = {"product_id": str(p.id), "qty_available": q, "selling_price": float(p.selling_price)}
                cmd.execution_status = "EXECUTED"
                await cmd.save()

                return VoiceResponse(
                    command_id=str(cmd.id),
                    transcript=transcript,
                    detected_language=language,
                    intent=intent,
                    entities=entities,
                    action_type="READ",
                    requires_confirmation=False,
                    tts_text=tts,
                    result=cmd.result,
                    execution_status="EXECUTED",
                )
            else:
                msg = f"No product found matching '{pname}'." if language == "en" else f"{pname} pharmacy-il kidaikkavillai."
                return VoiceResponse(
                    command_id=str(cmd.id),
                    transcript=transcript,
                    detected_language=language,
                    intent=intent,
                    entities=entities,
                    action_type="READ",
                    requires_confirmation=False,
                    tts_text=msg,
                    result={"found": False},
                    execution_status="EXECUTED",
                )

        elif intent == "GET_LOW_STOCK":
            products = await Product.find(Product.business_id == business_id).to_list()
            count = 0
            for p in products:
                invs = await Inventory.find(Inventory.product_id == str(p.id)).to_list()
                qty = sum(inv.qty_on_hand for inv in invs)
                if qty <= p.reorder_level:
                    count += 1
            
            tts = f"There are {count} items with low stock." if language == "en" else f"{count} items kammiyaaga stock irukku."
            cmd.result = {"low_stock_count": count}
            cmd.execution_status = "EXECUTED"
            await cmd.save()
            
            return VoiceResponse(
                command_id=str(cmd.id),
                transcript=transcript,
                detected_language=language,
                intent=intent,
                entities=entities,
                action_type="READ",
                requires_confirmation=False,
                tts_text=tts,
                result=cmd.result,
                execution_status="EXECUTED",
            )

        elif intent == "GET_TODAY_SALES":
            today_start = datetime.combine(date.today(), time.min, tzinfo=timezone.utc)
            sales = await Sale.find(Sale.business_id == business_id, Sale.created_at >= today_start).to_list()
            count = len(sales)
            rev = sum(float(s.total_amount) for s in sales)
            
            tts = f"Today's total sales are ₹{rev:,.2f} across {count} transactions." if language == "en" else f"Innaiku vyabaram motham ₹{rev:,.2f}, {count} sales aagi irukku."
            cmd.result = {"sales_count": count, "revenue": rev}
            cmd.execution_status = "EXECUTED"
            await cmd.save()
            
            return VoiceResponse(
                command_id=str(cmd.id),
                transcript=transcript,
                detected_language=language,
                intent=intent,
                entities=entities,
                action_type="READ",
                requires_confirmation=False,
                tts_text=tts,
                result=cmd.result,
                execution_status="EXECUTED",
            )

    # 4. Handle WRITE actions (Require Confirmation)
    if is_write:
        pname = entities.get("product_name", "")
        qty = entities.get("qty", 1)

        products = await Product.find(Product.business_id == business_id).to_list()
        matched_products = [p for p in products if pname.lower() in p.name.lower()]
        product = matched_products[0] if matched_products else None
        
        if not product:
            tts = f"Could not find product '{pname}' to sell."
            cmd.execution_status = "FAILED"
            cmd.result = {"error": "Product not found"}
            await cmd.save()
            return VoiceResponse(
                command_id=str(cmd.id),
                transcript=transcript,
                detected_language=language,
                intent=intent,
                entities=entities,
                action_type="WRITE",
                requires_confirmation=False,
                tts_text=tts,
                result=cmd.result,
                execution_status="FAILED",
            )

        invs = await Inventory.find(Inventory.product_id == str(product.id)).to_list()
        stock_on_hand = sum(inv.qty_on_hand for inv in invs)

        if stock_on_hand < qty:
            tts = f"Cannot sell {qty} units of {product.name}. Only {stock_on_hand} available in stock."
            cmd.execution_status = "FAILED"
            cmd.result = {"error": "Insufficient stock"}
            await cmd.save()
            return VoiceResponse(
                command_id=str(cmd.id),
                transcript=transcript,
                detected_language=language,
                intent=intent,
                entities=entities,
                action_type="WRITE",
                requires_confirmation=False,
                tts_text=tts,
                result=cmd.result,
                execution_status="FAILED",
            )

        unit_price = float(product.selling_price)
        total_price = round(unit_price * qty, 2)
        if language in ["tanglish", "ta"]:
            confirmation_prompt = f"{product.name} {qty} piece sell panna porom. Motha vilai ₹{total_price}. Confirm pannava?"
        else:
            confirmation_prompt = f"I found {product.name}. {qty} units will be deducted from inventory at ₹{unit_price}/unit (Total: ₹{total_price}). Confirm?"

        updated_entities = dict(entities)
        updated_entities.update({
            "product_id": str(product.id),
            "product_name": product.name,
            "unit_price": unit_price,
            "total_price": total_price,
            "branch_id": str(branch_id) if branch_id else None,
        })
        cmd.entities = updated_entities
        cmd.execution_status = "PENDING_CONFIRMATION"
        await cmd.save()

        return VoiceResponse(
            command_id=str(cmd.id),
            transcript=transcript,
            detected_language=language,
            intent=intent,
            entities=updated_entities,
            action_type="WRITE",
            requires_confirmation=True,
            confirmation_prompt=confirmation_prompt,
            tts_text=confirmation_prompt,
            result=None,
            execution_status="PENDING_CONFIRMATION",
        )

    # Unknown command fallback
    return VoiceResponse(
        command_id=str(cmd.id),
        transcript=transcript,
        detected_language=language,
        intent="UNKNOWN",
        entities=entities,
        action_type="READ",
        requires_confirmation=False,
        tts_text="Command not recognized. Try asking 'Paracetamol stock evlo irukku?' or 'Sell 10 Paracetamol'.",
        result=None,
        execution_status="EXECUTED",
    )


async def confirm_and_execute_voice_command(
    business_id: str,
    user_id: str,
    req: VoiceConfirmRequest,
    db=None,
) -> VoiceResponse:
    cmd = await VoiceCommand.find_one(VoiceCommand.id == to_oid(req.command_id), VoiceCommand.business_id == business_id)
    if not cmd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Voice command not found")

    if cmd.execution_status != "PENDING_CONFIRMATION":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Command already has status '{cmd.execution_status}'")

    if not req.confirmed:
        cmd.confirmed = False
        cmd.execution_status = "REJECTED"
        await cmd.save()
        return VoiceResponse(
            command_id=str(cmd.id),
            transcript=cmd.transcript,
            detected_language=cmd.language or "en",
            intent=cmd.intent or "",
            entities=cmd.entities or {},
            action_type="WRITE",
            requires_confirmation=False,
            tts_text="Operation cancelled.",
            result={"cancelled": True},
            execution_status="REJECTED",
        )

    entities = dict(cmd.entities or {})
    if "product_id" not in entities:
        pname = entities.get("product_name", "")
        products = await Product.find(Product.business_id == business_id).to_list()
        matched = [p for p in products if pname.lower() in p.name.lower()]
        if not matched:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        p = matched[0]
        entities["product_id"] = str(p.id)
        entities["unit_price"] = float(p.selling_price)

    product_id = entities["product_id"]
    qty = entities.get("qty", 1)
    unit_price = entities.get("unit_price", 10.0)
    branch_id_str = entities.get("branch_id")

    if not branch_id_str:
        from app.models.user import Branch
        b_res = await Branch.find_one(Branch.business_id == business_id)
        branch_id = str(b_res.id) if b_res else None
    else:
        branch_id = branch_id_str

    sale_req = SaleCreate(
        branch_id=branch_id,
        items=[SaleItemCreate(product_id=product_id, qty=qty, unit_price=unit_price)],
        payment_mode="CASH",
        notes=f"Created via Voice Command: {cmd.transcript}",
    )

    sale_resp = await create_sale(business_id=business_id, user_id=user_id, req=sale_req)

    cmd.confirmed = True
    cmd.execution_status = "EXECUTED"
    cmd.result = {"sale_id": str(sale_resp.id), "invoice_no": sale_resp.invoice_no, "total_amount": float(sale_resp.total_amount)}
    await cmd.save()

    lang = cmd.language or "en"
    if lang in ["tanglish", "ta"]:
        tts = f"Sale vetrigaramaga mudindhadhu. Invoice {sale_resp.invoice_no}, Total ₹{sale_resp.total_amount}."
    else:
        tts = f"Sale successfully executed. Invoice #{sale_resp.invoice_no} created for ₹{sale_resp.total_amount}."

    return VoiceResponse(
        command_id=str(cmd.id),
        transcript=cmd.transcript,
        detected_language=lang,
        intent=cmd.intent or "",
        entities=entities,
        action_type="WRITE",
        requires_confirmation=False,
        tts_text=tts,
        result=cmd.result,
        execution_status="EXECUTED",
    )
