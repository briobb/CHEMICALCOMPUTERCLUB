"use strict";

const CART_STORAGE_KEY = "ccc-test-cart";

const products = {
  tshirt1: {
    id: "tshirt1",
    name: "CCC Standard T-Shirt",
    price: 6000
  },

  tshirt2: {
    id: "tshirt2",
    name: "CCC Color T-Shirt",
    price: 6500
  },

  mug: {
    id: "mug",
    name: "CCC Buffer Mug",
    price: 2500
  }
};

let cart = loadCart();

/**
 * localStorageからカートを読み込む
 */
function loadCart() {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);

    if (!savedCart) {
      return [];
    }

    const parsedCart = JSON.parse(savedCart);

    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch (error) {
    console.error("カートの読み込みに失敗しました。", error);
    return [];
  }
}

/**
 * カートをlocalStorageへ保存する
 */
function saveCart() {
  try {
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify(cart)
    );
  } catch (error) {
    console.error("カートの保存に失敗しました。", error);
  }
}

/**
 * 金額を日本円形式にする
 */
function formatPrice(price) {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0
  }).format(price);
}

/**
 * 数量を安全な整数として取得する
 */
function getSafeQuantity(value) {
  const quantity = Number.parseInt(value, 10);

  if (!Number.isInteger(quantity) || quantity < 0) {
    return 0;
  }

  return Math.min(quantity, 20);
}

/**
 * カート内でバリエーションを識別するキーを作る
 */
function createCartItemKey(productId, size = "", color = "") {
  return [productId, color, size]
    .filter(Boolean)
    .join("-");
}

/**
 * 商品をカートへ追加する
 */
function addItemToCart(item) {
  const existingItem = cart.find(
    cartItem => cartItem.key === item.key
  );

  if (existingItem) {
    existingItem.quantity += item.quantity;
  } else {
    cart.push(item);
  }
}

/**
 * メッセージを表示する
 */
function showMessage(elementId, message, type) {
  const messageElement = document.getElementById(elementId);

  if (!messageElement) {
    return;
  }

  messageElement.textContent = message;
  messageElement.className = `product-message ${type}`;

  window.setTimeout(() => {
    messageElement.textContent = "";
    messageElement.className = "product-message";
  }, 3500);
}

/**
 * Tシャツ1を一括追加する
 */
function addTshirt1ToCart() {
  const quantityInputs = document.querySelectorAll(
    ".tshirt1-quantity"
  );

  let addedVariationCount = 0;
  let addedItemCount = 0;

  quantityInputs.forEach(input => {
    const quantity = getSafeQuantity(input.value);
    const size = input.dataset.size;

    if (quantity <= 0) {
      return;
    }

    addItemToCart({
      key: createCartItemKey(
        products.tshirt1.id,
        size
      ),
      productId: products.tshirt1.id,
      name: products.tshirt1.name,
      price: products.tshirt1.price,
      size,
      color: "",
      quantity
    });

    addedVariationCount += 1;
    addedItemCount += quantity;

    input.value = "0";
  });

  if (addedVariationCount === 0) {
    showMessage(
      "tshirt1-message",
      "1つ以上のサイズに数量を入力してください。",
      "error"
    );

    return;
  }

  saveCart();
  renderCart();

  showMessage(
    "tshirt1-message",
    `${addedVariationCount}種類、合計${addedItemCount}枚を追加しました。`,
    "success"
  );
}

/**
 * Tシャツ2を一括追加する
 */
function addTshirt2ToCart() {
  const quantityInputs = document.querySelectorAll(
    ".tshirt2-quantity"
  );

  let addedVariationCount = 0;
  let addedItemCount = 0;

  quantityInputs.forEach(input => {
    const quantity = getSafeQuantity(input.value);
    const size = input.dataset.size;
    const color = input.dataset.color;

    if (quantity <= 0) {
      return;
    }

    addItemToCart({
      key: createCartItemKey(
        products.tshirt2.id,
        size,
        color
      ),
      productId: products.tshirt2.id,
      name: products.tshirt2.name,
      price: products.tshirt2.price,
      size,
      color,
      quantity
    });

    addedVariationCount += 1;
    addedItemCount += quantity;

    input.value = "0";
  });

  if (addedVariationCount === 0) {
    showMessage(
      "tshirt2-message",
      "1つ以上のカラーとサイズに数量を入力してください。",
      "error"
    );

    return;
  }

  saveCart();
  renderCart();

  showMessage(
    "tshirt2-message",
    `${addedVariationCount}種類、合計${addedItemCount}枚を追加しました。`,
    "success"
  );
}

/**
 * マグカップを追加する
 */
function addMugToCart() {
  const quantityInput = document.getElementById(
    "mug-quantity"
  );

  const quantity = getSafeQuantity(quantityInput.value);

  if (quantity <= 0) {
    showMessage(
      "mug-message",
      "数量を1個以上入力してください。",
      "error"
    );

    return;
  }

  addItemToCart({
    key: createCartItemKey(products.mug.id),
    productId: products.mug.id,
    name: products.mug.name,
    price: products.mug.price,
    size: "",
    color: "",
    quantity
  });

  quantityInput.value = "0";

  saveCart();
  renderCart();

  showMessage(
    "mug-message",
    `${quantity}個をカートに追加しました。`,
    "success"
  );
}

/**
 * 商品のバリエーション表記を作る
 */
function getVariationText(item) {
  const variations = [];

  if (item.color) {
    variations.push(`カラー：${item.color}`);
  }

  if (item.size) {
    variations.push(`サイズ：${item.size}`);
  }

  if (variations.length === 0) {
    return "バリエーションなし";
  }

  return variations.join(" / ");
}

/**
 * カートの商品数量を変更する
 */
function changeCartQuantity(itemKey, amount) {
  const item = cart.find(
    cartItem => cartItem.key === itemKey
  );

  if (!item) {
    return;
  }

  item.quantity += amount;

  if (item.quantity <= 0) {
    cart = cart.filter(
      cartItem => cartItem.key !== itemKey
    );
  }

  saveCart();
  renderCart();
}

/**
 * 商品をカートから削除する
 */
function removeCartItem(itemKey) {
  cart = cart.filter(
    cartItem => cartItem.key !== itemKey
  );

  saveCart();
  renderCart();
}

/**
 * カートを空にする
 */
function clearCart() {
  if (cart.length === 0) {
    return;
  }

  const shouldClear = window.confirm(
    "カート内の商品をすべて削除しますか？"
  );

  if (!shouldClear) {
    return;
  }

  cart = [];

  saveCart();
  renderCart();
}

/**
 * HTML用に文字を安全に変換する
 */
function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/**
 * カートを画面に表示する
 */
function renderCart() {
  const cartItemsElement = document.getElementById(
    "cart-items"
  );

  const cartCountElement = document.getElementById(
    "cart-count"
  );

  const summaryCountElement = document.getElementById(
    "summary-count"
  );

  const summaryTotalElement = document.getElementById(
    "summary-total"
  );

  const checkoutButton = document.getElementById(
    "checkout-button"
  );

  const totalQuantity = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  const totalPrice = cart.reduce(
    (sum, item) => {
      return sum + item.price * item.quantity;
    },
    0
  );

  cartCountElement.textContent = totalQuantity;
  summaryCountElement.textContent = `${totalQuantity}点`;
  summaryTotalElement.textContent = formatPrice(totalPrice);

  checkoutButton.disabled = cart.length === 0;

  if (cart.length === 0) {
    cartItemsElement.innerHTML = `
      <div class="empty-cart">
        カートにはまだ商品が入っていません。
      </div>
    `;

    return;
  }

  cartItemsElement.innerHTML = cart
    .map(item => {
      const itemSubtotal = item.price * item.quantity;

      return `
        <article class="cart-item">
          <div>
            <h3 class="cart-item-name">
              ${escapeHtml(item.name)}
            </h3>

            <p class="cart-item-variation">
              ${escapeHtml(getVariationText(item))}
            </p>
          </div>

          <div class="cart-item-price">
            ${formatPrice(itemSubtotal)}
          </div>

          <div class="cart-quantity-controls">
            <button
              type="button"
              class="quantity-button"
              data-action="decrease"
              data-key="${escapeHtml(item.key)}"
              aria-label="数量を1つ減らす"
            >
              −
            </button>

            <span class="cart-item-quantity">
              ${item.quantity}
            </span>

            <button
              type="button"
              class="quantity-button"
              data-action="increase"
              data-key="${escapeHtml(item.key)}"
              aria-label="数量を1つ増やす"
            >
              ＋
            </button>
          </div>

          <button
            type="button"
            class="remove-button"
            data-action="remove"
            data-key="${escapeHtml(item.key)}"
          >
            削除
          </button>
        </article>
      `;
    })
    .join("");
}

/**
 * カート内ボタンのイベント処理
 */
function handleCartClick(event) {
  const button = event.target.closest(
    "button[data-action]"
  );

  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const itemKey = button.dataset.key;

  if (action === "increase") {
    changeCartQuantity(itemKey, 1);
  }

  if (action === "decrease") {
    changeCartQuantity(itemKey, -1);
  }

  if (action === "remove") {
    removeCartItem(itemKey);
  }
}

/**
 * 仮の購入ボタン
 */
function handleCheckout() {
  if (cart.length === 0) {
    return;
  }

  console.log("Stripeへ送信する予定のカートデータ:", cart);

  window.alert(
    "カート機能は正常に動いています。\n次の段階でCloudflare WorkersとStripe Checkoutを接続します。"
  );
}

/**
 * 初期設定
 */
function initialize() {
  document
    .getElementById("add-tshirt1")
    .addEventListener("click", addTshirt1ToCart);

  document
    .getElementById("add-tshirt2")
    .addEventListener("click", addTshirt2ToCart);

  document
    .getElementById("add-mug")
    .addEventListener("click", addMugToCart);

  document
    .getElementById("clear-cart")
    .addEventListener("click", clearCart);

  document
    .getElementById("cart-items")
    .addEventListener("click", handleCartClick);

  document
    .getElementById("checkout-button")
    .addEventListener("click", handleCheckout);

  renderCart();
}

initialize();
