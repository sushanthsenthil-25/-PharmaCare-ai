from fastapi import APIRouter, Depends

from app.auth.dependencies import get_current_user, CurrentUser
from app.schemas.order import AIChatRequest, AIChatResponse
from app.schemas.voice import VoiceProcessRequest, VoiceResponse, VoiceConfirmRequest
from app.services.ai_service import parse_and_process_ai_query
from app.services.voice_service import process_voice_command, confirm_and_execute_voice_command

router = APIRouter(prefix="/api/v1/ai", tags=["AI & Voice"])


@router.post("/chat", response_model=AIChatResponse)
async def ai_chat(
    req: AIChatRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Business-scoped AI Chat endpoint.
    READ operations execute immediately.
    WRITE operations (e.g. 'Sell 10 Paracetamol') generate explicit confirmation prompts.
    """
    return await parse_and_process_ai_query(
        business_id=current_user.business_id,
        user_id=current_user.id,
        branch_id=current_user.branch_id,
        message=req.message,
    )


@router.post("/voice", response_model=VoiceResponse)
async def ai_voice(
    req: VoiceProcessRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """
    Multilingual Clinical Voice pipeline:
    Supports English, Tamil, and Tanglish (e.g. 'Paracetamol stock evlo irukku?').
    READ actions execute immediately; WRITE actions require confirmation.
    """
    return await process_voice_command(
        business_id=current_user.business_id,
        user_id=current_user.id,
        branch_id=current_user.branch_id,
        req=req,
    )


@router.post("/voice/confirm", response_model=VoiceResponse)
async def ai_voice_confirm(
    req: VoiceConfirmRequest,
    current_user: CurrentUser = Depends(get_current_user),
):
    """Confirm and execute a pending voice write command."""
    return await confirm_and_execute_voice_command(
        business_id=current_user.business_id,
        user_id=current_user.id,
        req=req,
    )
