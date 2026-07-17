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
  if (source.dataset.modalLink) {
    modalPurchase.href = source.dataset.modalLink;
    modalPurchase.textContent = source.dataset.modalLinkLabel || 'Purchase';
    modalPurchase.hidden = false;
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
document.querySelector('.modal-close').addEventListener('click', closeModal);
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
