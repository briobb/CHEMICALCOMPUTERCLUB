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
const modalPurchase = document.querySelector('#modal-purchase');
let lastTrigger;

function openModal(trigger) {
  const source = trigger.closest('[data-modal-title]');
  lastTrigger = trigger;
  modalTitle.textContent = source.dataset.modalTitle;
  modalCopy.textContent = source.dataset.modalCopy;
  modalPrice.textContent = source.dataset.modalPrice ? `¥${source.dataset.modalPrice}` : '';
  modalPrice.hidden = !source.dataset.modalPrice;
  if (source.dataset.modalImage) {
    modalImage.src = source.dataset.modalImage;
    modalImage.alt = `${source.dataset.modalTitle}の拡大画像`;
    modalImage.hidden = false;
  } else {
    modalImage.hidden = true;
  }
  modalGallery.replaceChildren();
  const galleryImages = source.dataset.modalGallery?.split(',').filter(Boolean) || [];
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
  if (source.dataset.modalLink) {
    modalPurchase.textContent = source.dataset.modalLinkLabel || 'Purchase';
    modalPurchase.hidden = false;
    modalPurchase.removeAttribute('href');
    modalPurchase.setAttribute('aria-disabled', 'true');
    modalPurchase.setAttribute('tabindex', '-1');
    modalPurchase.classList.add('is-disabled');
  } else {
    modalPurchase.hidden = true;
    modalPurchase.removeAttribute('href');
  }
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
