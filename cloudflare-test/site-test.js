// Mobile navigation
const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.site-nav');
const menuLabel = menuButton.querySelector('.sr-only');
menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  navigation.classList.toggle('open', !open);
  menuLabel.textContent = open ? 'メニューを開く' : 'メニューを閉じる';
});
navigation.addEventListener('click', (event) => {
  if (event.target.matches('a')) {
    navigation.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuLabel.textContent = 'メニューを開く';
  }
});

// Shared product and event detail modal
const modal = document.querySelector('#detail-modal');
const modalTitle = document.querySelector('#modal-title');
const modalCopy = document.querySelector('#modal-copy');
const modalPrice = document.querySelector('#modal-price');
const modalImage = document.querySelector('#modal-image');
const modalMedia = document.querySelector('#modal-media');
const modalGallery = document.querySelector('#modal-gallery');
const cartOptions = document.querySelector('#cart-options');
const variantLabel = document.querySelector('#variant-label');
const productVariant = document.querySelector('#product-variant');
const productQuantity = document.querySelector('#product-quantity');
let lastTrigger;
let currentProduct = null;

function openModal(trigger) {
  const source = trigger.closest('[data-modal-title]');
  lastTrigger = trigger;
  modalTitle.textContent = source.dataset.modalTitle;
  modalCopy.textContent = source.dataset.modalCopy;
  modalPrice.textContent = source.dataset.modalPrice ? `¥${source.dataset.modalPrice}` : '';
  modalPrice.hidden = !source.dataset.modalPrice;
  currentProduct = source.dataset.productId ? {
    id: source.dataset.productId,
    name: source.dataset.modalTitle,
    price: Number(source.dataset.modalPrice),
    image: source.dataset.modalImage
  } : null;
  cartOptions.hidden = !currentProduct;
  document.querySelector('#cart-feedback').textContent = '';
  productQuantity.value = '1';
  const variants = source.dataset.productVariants?.split(',').filter(Boolean) || [];
  variantLabel.hidden = variants.length === 0;
  productVariant.replaceChildren(...variants.map((variant) => new Option(variant, variant)));
  if (source.dataset.modalImage) {
    modalImage.src = source.dataset.modalImage;
    modalImage.alt = `${source.dataset.modalTitle}の拡大画像`;
    modalImage.hidden = false;
  } else {
    modalImage.hidden = true;
  }
  modalGallery.replaceChildren();
  const galleryImages = source.dataset.modalGallery?.split(',').filter(Boolean) || [];
  if (source.dataset.modalImage && galleryImages.length > 0) {
    const primaryButton = document.createElement('button');
    primaryButton.type = 'button';
    primaryButton.className = 'modal-thumbnail is-primary is-active';
    primaryButton.setAttribute('aria-label', `${source.dataset.modalTitle}のメイン写真を拡大表示`);
    const primaryImage = document.createElement('img');
    primaryImage.src = source.dataset.modalImage;
    primaryImage.alt = `${source.dataset.modalTitle}のメイン写真`;
    primaryButton.appendChild(primaryImage);
    primaryButton.addEventListener('click', () => {
      modalImage.src = source.dataset.modalImage;
      modalImage.alt = primaryImage.alt;
      modalGallery.querySelectorAll('.modal-thumbnail').forEach((thumbnail) => {
        thumbnail.classList.toggle('is-active', thumbnail === primaryButton);
      });
    });
    modalGallery.appendChild(primaryButton);
  }
  galleryImages.forEach((imagePath, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'modal-thumbnail';
    button.setAttribute('aria-label', `${source.dataset.modalTitle}の商品写真 ${index + 2}を拡大表示`);
    const image = document.createElement('img');
    image.src = imagePath;
    image.alt = `${source.dataset.modalTitle}の商品写真 ${index + 2}`;
    image.loading = 'lazy';
    image.decoding = 'async';
    button.appendChild(image);
    button.addEventListener('click', () => {
      modalImage.src = imagePath;
      modalImage.alt = image.alt;
      modalGallery.querySelectorAll('.modal-thumbnail').forEach((thumbnail) => {
        thumbnail.classList.toggle('is-active', thumbnail === button);
      });
    });
    modalGallery.appendChild(button);
  });
  modalGallery.hidden = galleryImages.length === 0;
  modalMedia.hidden = !source.dataset.modalImage && galleryImages.length === 0;
  modal.showModal();
  document.body.classList.add('modal-open');
}

document.querySelectorAll('.modal-trigger, .event-row').forEach((trigger) => {
  trigger.addEventListener('click', () => openModal(trigger));
});
function closeModal() {
  modal.close();
  document.body.classList.remove('modal-open');
  lastTrigger?.focus();
}
document.querySelector('.modal-close-action').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => {
  if (event.target === modal) closeModal();
});
modal.addEventListener('close', () => document.body.classList.remove('modal-open'));

// Cart test: local browser storage only. No payment request is made.
const CART_KEY = 'ccc-modal-cart-test';
const cartModal = document.querySelector('#cart-modal');
let cart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');

function formatPrice(value) {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(value);
}

function saveAndRenderCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  document.querySelector('#cart-count').textContent = count;
  document.querySelector('#cart-total').textContent = formatPrice(total);
  document.querySelector('#test-checkout').disabled = count === 0;
  const container = document.querySelector('#cart-items');
  if (cart.length === 0) {
    container.innerHTML = '<p class="empty-cart">カートにはまだ商品が入っていません。</p>';
    return;
  }
  container.innerHTML = cart.map((item) => `
    <article class="cart-line">
      <img src="${item.image}" alt="">
      <div><h3>${item.name}</h3><p>${item.variant ? `サイズ：${item.variant}` : 'バリエーションなし'}</p><p>${formatPrice(item.price)}</p></div>
      <div class="cart-line-controls"><button type="button" data-cart-action="decrease" data-key="${item.key}" aria-label="数量を減らす">−</button><span>${item.quantity}</span><button type="button" data-cart-action="increase" data-key="${item.key}" aria-label="数量を増やす">＋</button><button type="button" data-cart-action="remove" data-key="${item.key}">削除</button></div>
    </article>`).join('');
}

document.querySelector('#add-to-cart').addEventListener('click', () => {
  if (!currentProduct) return;
  const quantity = Math.max(1, Math.min(20, Number.parseInt(productQuantity.value, 10) || 1));
  const variant = variantLabel.hidden ? '' : productVariant.value;
  const key = [currentProduct.id, variant].filter(Boolean).join('-');
  const existing = cart.find((item) => item.key === key);
  if (existing) existing.quantity += quantity;
  else cart.push({ ...currentProduct, key, variant, quantity });
  saveAndRenderCart();
  document.querySelector('#cart-feedback').textContent = `${quantity}点をカートに追加しました。`;
});

document.querySelector('#open-cart').addEventListener('click', () => cartModal.showModal());
document.querySelector('#close-cart').addEventListener('click', () => cartModal.close());
document.querySelector('#clear-cart').addEventListener('click', () => { cart = []; saveAndRenderCart(); });
document.querySelector('#cart-items').addEventListener('click', (event) => {
  const button = event.target.closest('[data-cart-action]');
  if (!button) return;
  const item = cart.find((entry) => entry.key === button.dataset.key);
  if (!item) return;
  if (button.dataset.cartAction === 'increase') item.quantity += 1;
  if (button.dataset.cartAction === 'decrease') item.quantity -= 1;
  if (button.dataset.cartAction === 'remove' || item.quantity <= 0) cart = cart.filter((entry) => entry.key !== item.key);
  saveAndRenderCart();
});
document.querySelector('#test-checkout').addEventListener('click', () => window.alert('カート機能は正常に動作しています。決済処理はまだ接続されていません。'));
cartModal.addEventListener('click', (event) => { if (event.target === cartModal) cartModal.close(); });
saveAndRenderCart();

// Gentle entrance animation; content remains visible when motion is reduced.
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });
document.querySelectorAll('.reveal').forEach((element) => revealObserver.observe(element));
