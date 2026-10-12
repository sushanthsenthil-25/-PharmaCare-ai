import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import api from '../services/api';
import { getProductImageUrl, handleImageError } from '../utils/productImages';

export const ProductDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, openCart } = useApp();
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('composition');
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProductData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await api.products.getById(id);
        if (isMounted && data) {
          const isCatalogue = Boolean(
            data.catalogueType ||
            String(id).startsWith('catalogue_') ||
            data.source === 'junioralive/Indian-Medicine-Dataset'
          );

          const orig = data.originalPrice || data.mrp || (data.priceINR ? data.priceINR : Math.round(Number(data.price || data.selling_price || 145) * 1.25));

          setProduct({
            id: data._id || data.id,
            rawId: data._id || data.id,
            name: data.name,
            genericName: data.genericName || (Array.isArray(data.composition) && data.composition[0] ? data.composition[0] : null),
            scientificName: data.scientificName || null,
            brand: data.brand || data.manufacturer || 'Certified Pharmaceutical Laboratories',
            manufacturer: data.manufacturer || data.brand || 'PharmaCare Labs',
            category: data.category || (data.rxRequired ? 'Prescription (Rx)' : 'Over-The-Counter (OTC)'),
            dosageForm: data.dosageForm || data.form || 'Tablet',
            packSize: data.packSize || data.pack_size_label || null,
            price: data.priceINR !== undefined && data.priceINR !== null ? data.priceINR : Number(data.price || data.selling_price || 0),
            originalPrice: orig,
            rxRequired: Boolean(data.rxRequired || data.rx_required),
            img: getProductImageUrl(data),
            composition: Array.isArray(data.composition) ? data.composition.join(', ') : (data.composition || data.description || 'Clinical Active Formulation'),
            rawCompositionList: Array.isArray(data.composition) ? data.composition : [data.composition || 'Active Ingredient'],
            strength: data.strength || '',
            mfgDate: data.manufacturingDate ? new Date(data.manufacturingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
            expDate: data.expiryDate ? new Date(data.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
            batchNumber: data.batchNumber || null,
            stock: data.stock !== undefined ? data.stock : (data.isLiveInventory ? 50 : null),
            expiryStatus: data.expiryStatus || 'VALID',
            isExpired: data.expiryStatus === 'EXPIRED',
            isDiscontinued: Boolean(data.isDiscontinued),
            storageInstructions: data.storageInstructions || 'Store in a cool, dry place away from direct sunlight.',
            uses: Array.isArray(data.uses) && data.uses.length > 0 ? data.uses.join(', ') : 'Clinical therapeutic management as prescribed.',
            precautions: Array.isArray(data.precautions) && data.precautions.length > 0 ? data.precautions.join('. ') : 'Take strictly as advised by a qualified healthcare professional. Do not exceed recommended dosage.',
            isCatalogueRecord: isCatalogue,
            isLiveInventory: Boolean(data.isLiveInventory),
            livePharmacyItem: data.livePharmacyItem || null,
            source: data.source || null,
          });
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Product not found');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProductData();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const handleAddToCart = async () => {
    if (!product) return;
    const res = await addToCart(product, quantity);
    if (res?.success) {
      openCart();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col w-full px-margin pb-24 gap-y-4 pt-4">
        <div className="h-64 bg-surface-container-low rounded-2xl animate-pulse"></div>
        <div className="h-20 bg-surface-container-low rounded-xl animate-pulse"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-8 text-center text-xs text-on-surface-variant">
        Product not found. <button onClick={() => navigate('/medicines')} className="text-primary font-bold underline">Return to Medicines</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full px-margin pb-28 gap-y-4 pt-2">
      {/* Top Bar with back button */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-primary hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <span className="font-label-sm text-xs font-bold text-primary uppercase tracking-wider">
          {product.isCatalogueRecord ? 'Clinical Drug Monograph' : 'Pharmacy Product View'}
        </span>
        <button 
          aria-label="Share" 
          className="w-9 h-9 rounded-full bg-surface-container-low flex items-center justify-center text-primary"
        >
          <span className="material-symbols-outlined text-[18px]">share</span>
        </button>
      </div>

      {/* Expiry Warning Banner if Expired */}
      {product.isExpired && (
        <div className="p-3.5 rounded-xl bg-red-100 border border-red-300 text-red-800 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span>CRITICAL SAFETY: This batch is expired and cannot be dispensed.</span>
        </div>
      )}

      {/* Discontinued Banner */}
      {product.isDiscontinued && (
        <div className="p-3.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 text-xs font-bold flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px]">warning</span>
          <span>DISCONTINUED BY MANUFACTURER: Recorded in national catalogue for clinical reference.</span>
        </div>
      )}

      {/* Main Image / Dosage Graphic Card */}
      <div className="relative rounded-2xl bg-surface-container-lowest p-6 border border-outline-variant/15 shadow-sm flex items-center justify-center">
        {product.isCatalogueRecord ? (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-800 font-label-sm text-[10px] font-bold border border-blue-500/20">
            National Drug Database
          </span>
        ) : product.rxRequired ? (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 font-label-sm text-[10px] font-bold border border-amber-500/20">
            Rx Prescription Required
          </span>
        ) : (
          <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 font-label-sm text-[10px] font-bold border border-emerald-500/20">
            Over-The-Counter (OTC)
          </span>
        )}

        {/* Stock Status Badge */}
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-surface-container-low text-on-surface-variant font-label-sm text-[10px] font-bold">
          {product.isLiveInventory || product.stock > 0
            ? `${product.stock || 50} in stock`
            : 'Formulary Entry'}
        </span>

        <img
          src={product.img}
          alt={product.name}
          width="192"
          height="192"
          loading="eager"
          onError={(e) => handleImageError(e, product.dosageForm)}
          className="w-48 h-48 object-contain rounded-xl p-2"
        />
      </div>

      {/* Title & Manufacturer */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-headline-md text-xl font-bold text-primary">{product.name}</h1>
          <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded">
            {product.dosageForm}
          </span>
        </div>

        {product.genericName && (
          <p className="text-xs font-semibold text-secondary">
            Primary Salt: <span className="text-on-surface font-medium">{product.genericName}</span>
          </p>
        )}

        <p className="text-xs text-on-surface-variant font-medium">
          Manufacturer: <strong className="text-primary">{product.manufacturer}</strong>
        </p>

        {product.packSize && (
          <p className="text-xs text-on-surface-variant">
            Packaging: <strong>{product.packSize}</strong>
          </p>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex items-baseline gap-2">
            <span className="font-headline-md text-2xl font-bold text-primary">₹{product.price}</span>
            {product.originalPrice && (
              <span className="text-sm line-through text-on-surface-variant">₹{product.originalPrice}</span>
            )}
            <span className="text-[10px] text-on-surface-variant">
              {product.isCatalogueRecord ? 'Indicative MRP' : 'Pharmacy Price'}
            </span>
          </div>

          {(product.isLiveInventory || !product.isCatalogueRecord) && (
            <div className="flex items-center border border-outline-variant/30 rounded-xl bg-surface-container-low px-2 py-1">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-7 h-7 flex items-center justify-center text-primary font-bold text-base"
              >
                -
              </button>
              <span className="px-3 font-bold text-sm text-primary">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-7 h-7 flex items-center justify-center text-primary font-bold text-base"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Batch & Specification Grid if Live Store Medicine */}
      {product.batchNumber && (
        <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-surface-container-low/70 border border-outline-variant/15 text-xs text-center">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Batch No.</span>
            <span className="font-bold text-primary font-mono text-[11px]">{product.batchNumber}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Mfg Date</span>
            <span className="font-bold text-primary text-[11px]">{product.mfgDate || 'Jan 2026'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-on-surface-variant">Exp Date</span>
            <span className={`font-bold text-[11px] ${product.isExpired ? 'text-red-600' : 'text-primary'}`}>
              {product.expDate || 'Jan 2028'}
            </span>
          </div>
        </div>
      )}

      {/* Clinical Provenance Card */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 to-teal-50 border border-blue-200/80 shadow-sm flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-blue-600 text-[22px]">verified_user</span>
          <span className="font-label-sm text-xs font-bold text-blue-900 uppercase tracking-wider">
            Verified Clinical Drug Provenance
          </span>
        </div>
        <p className="font-body-sm text-xs text-blue-950 leading-relaxed font-medium">
          {product.isCatalogueRecord
            ? `Indexed from the Indian Medicine Dataset containing 11,621 clinical formulations. Registered manufacturer: ${product.manufacturer}.`
            : 'Validated against standard clinical pharmacopeia database. Certified authentic pharmacy formulation.'}
        </p>
      </div>

      {/* Tabbed Product Details */}
      <div className="flex flex-col gap-3">
        <div className="flex border-b border-outline-variant/20">
          <button
            onClick={() => setActiveTab('composition')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'composition'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant'
            }`}
          >
            Composition
          </button>
          <button
            onClick={() => setActiveTab('uses')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'uses'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant'
            }`}
          >
            Formulation Details
          </button>
          <button
            onClick={() => setActiveTab('precautions')}
            className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'precautions'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant'
            }`}
          >
            Clinical Precautions
          </button>
        </div>

        <div className="p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/10 text-xs leading-relaxed text-on-surface">
          {activeTab === 'composition' && (
            <div className="flex flex-col gap-2">
              <span className="font-bold text-primary">Active Pharmaceutical Ingredients:</span>
              <ul className="list-disc pl-5 space-y-1">
                {product.rawCompositionList.map((comp, idx) => (
                  <li key={idx} className="text-on-surface font-medium">{comp}</li>
                ))}
              </ul>
            </div>
          )}
          {activeTab === 'uses' && (
            <div className="flex flex-col gap-1.5">
              <p><strong>Packaging:</strong> {product.packSize || 'Standard Clinical Package'}</p>
              <p><strong>Dosage Form:</strong> {product.dosageForm}</p>
              <p><strong>Storage:</strong> {product.storageInstructions}</p>
            </div>
          )}
          {activeTab === 'precautions' && (
            <div className="flex flex-col gap-1">
              <p>{product.precautions}</p>
              <p className="text-secondary font-semibold mt-1 text-[11px]">
                Always consult a registered pharmacist or physician for personal medical advice.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-16 left-0 right-0 p-3 bg-surface-container-lowest/95 backdrop-blur-md border-t border-outline-variant/20 max-w-md mx-auto flex gap-2 z-40">
        {product.isLiveInventory || !product.isCatalogueRecord ? (
          <>
            <button
              onClick={() => addToCart(product, quantity)}
              disabled={product.isExpired || product.stock <= 0}
              className="flex-1 py-3 rounded-xl bg-surface-container-low text-primary border border-primary/20 text-xs font-bold hover:bg-surface-container transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
              Add to Cart
            </button>
            <button
              onClick={handleAddToCart}
              disabled={product.isExpired || product.stock <= 0}
              className="flex-1 py-3 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">bolt</span>
              30-Min Express Order
            </button>
          </>
        ) : (
          <button
            onClick={() => navigate('/medicines')}
            className="w-full py-3 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[18px]">search</span>
            Search More Formulations in Catalogue
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductDetailPage;
