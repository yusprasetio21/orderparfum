// app.js - Mobile Store Main Logic (Vanilla JS)
// ============================================================
// Menggantikan:
// - mobile/index.php (bagian inline JS + cart functions)
// - mobile/script.jss
// - mobile/update_cart.php
// - mobile/get_cart.php
// - mobile/update_likes.php
// - mobile/save_order.php (via Supabase langsung)
// ============================================================

const App = (() => {
  "use strict";

  // ============================================================
  // STATE
  // ============================================================
  let state = {
    products: [],
    categories: [],
    currentProducts: [], // Untuk cart checkout
    currentProductId: "",
    currentProductName: "",
    currentProductPrice: 0,
    currentProductImage: "",
    deliveryOption: "pickup",
    shippingCost: 15000,
    shippingType: "regular",
    gpsMethod: "gps",
    checkoutType: "single", // 'single' atau 'cart'
    selectedAddress: null,
    currentLocation: null,
    isLoading: true,
    categoryFilter: "",
    searchQuery: "",
  };

  // Data kota untuk simulasi GPS
  const cities = [
    { id: "bogor", name: "Bogor", province: "Jawa Barat" },
    { id: "jakarta", name: "Jakarta", province: "DKI Jakarta" },
    { id: "bandung", name: "Bandung", province: "Jawa Barat" },
    { id: "depok", name: "Depok", province: "Jawa Barat" },
    { id: "tangerang", name: "Tangerang", province: "Banten" },
    { id: "bekasi", name: "Bekasi", province: "Jawa Barat" },
    { id: "surabaya", name: "Surabaya", province: "Jawa Timur" },
    { id: "semarang", name: "Semarang", province: "Jawa Tengah" },
    { id: "yogyakarta", name: "Yogyakarta", province: "DI Yogyakarta" },
    { id: "malang", name: "Malang", province: "Jawa Timur" },
    { id: "medan", name: "Medan", province: "Sumatera Utara" },
    { id: "palembang", name: "Palembang", province: "Sumatera Selatan" },
    { id: "makassar", name: "Makassar", province: "Sulawesi Selatan" },
    { id: "balikpapan", name: "Balikpapan", province: "Kalimantan Timur" },
    { id: "denpasar", name: "Denpasar", province: "Bali" },
  ];

  const locationData = {
    bogor: [
      {
        name: "Bogor Trade Mall",
        address: "Jl. Raya Tajur No. 101, Bogor",
        distance: "1.2 km",
      },
      {
        name: "Botani Square",
        address: "Jl. Raya Pajajaran, Bogor",
        distance: "0.8 km",
      },
      {
        name: "Plaza Bogor",
        address: "Jl. Kapten Muslihat No. 8, Bogor",
        distance: "2.1 km",
      },
      {
        name: "Cibinong City Mall",
        address: "Jl. Raya Mayor Oking, Bogor",
        distance: "5.3 km",
      },
    ],
    jakarta: [
      {
        name: "Grand Indonesia",
        address: "Jl. M.H. Thamrin No.1, Jakarta Pusat",
        distance: "0.5 km",
      },
      {
        name: "Plaza Senayan",
        address: "Jl. Asia Afrika No.8, Jakarta Selatan",
        distance: "1.2 km",
      },
      {
        name: "Central Park Mall",
        address: "Jl. Letjen S. Parman, Jakarta Barat",
        distance: "2.5 km",
      },
    ],
    bandung: [
      {
        name: "Paris Van Java",
        address: "Jl. Sukajadi, Bandung",
        distance: "0.8 km",
      },
      { name: "Braga", address: "Jl. Braga, Bandung", distance: "1.5 km" },
      {
        name: "Setiabudi",
        address: "Jl. Dr. Setiabudi, Bandung",
        distance: "2.1 km",
      },
    ],
  };

  // ============================================================
  // INIT
  // ============================================================
  async function init() {
    console.log("[App] Initializing...");

    // Baca filter dari URL
    state.categoryFilter = Utils.getUrlParam("category") || "";
    state.searchQuery = Utils.getUrlParam("search") || "";

    // Load data dari Supabase
    await loadData();

    // Render UI
    renderCategories();
    renderProducts();
    updateCartUI();
    populateCityGrid();

    // Event listeners
    attachEventListeners();

    state.isLoading = false;
    console.log("[App] Ready");
  }

  // ============================================================
  // DATA LOADING
  // ============================================================
  async function loadData() {
    try {
      const requests = [
        {
          endpoint: "cust_categories",
          method: "GET",
          filters: { select: "id,name", order: "name.asc", limit: "10" },
        },
        {
          endpoint: "cust_products",
          method: "GET",
          filters: {
            select:
              "id,name,price,likes_count,image_url,short_description,category_id,cust_categories(name)",
            order: "created_at.desc",
            limit: "50",
          },
        },
      ];

      const results = await SUPABASE.multi(requests);

      if (results[0].success && Array.isArray(results[0].data)) {
        state.categories = results[0].data;
      }

      if (results[1].success && Array.isArray(results[1].data)) {
        state.products = results[1].data;
      }
    } catch (error) {
      console.error("[App] Load data error:", error);
      Utils.Toast.error("Gagal memuat data produk");
    }
  }

  // ============================================================
  // RENDER: CATEGORIES
  // ============================================================
  function renderCategories() {
    const container = document.getElementById("filter-container");
    if (!container) return;

    let html = `
            <button class="filter-btn ${!state.categoryFilter ? "active" : ""}"
                    onclick="App.filterByCategory('')">
                Semua
            </button>
        `;

    state.categories.forEach((cat) => {
      html += `
                <button class="filter-btn ${state.categoryFilter === String(cat.id) ? "active" : ""}"
                        onclick="App.filterByCategory('${cat.id}')">
                    ${Utils.sanitize(cat.name)}
                </button>
            `;
    });

    container.innerHTML = html;
  }

  // ============================================================
  // RENDER: PRODUCTS
  // ============================================================
  function renderProducts() {
    const container = document.getElementById("products-container");
    if (!container) return;

    let filtered = [...state.products];

    // Filter kategori
    if (state.categoryFilter) {
      filtered = filtered.filter(
        (p) => String(p.category_id) === String(state.categoryFilter),
      );
    }

    // Filter search
    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.short_description || "").toLowerCase().includes(q),
      );
    }

    if (filtered.length === 0) {
      container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-wine-bottle"></i>
                    <h3>Tidak ada produk</h3>
                    <p>Silakan coba kategori lain atau cari dengan kata kunci berbeda</p>
                </div>
            `;
      return;
    }

    let html = "";
    filtered.forEach((product, idx) => {
      const productId = product.id;
      const productName = product.name || "Produk";
      const productPrice = product.price || 0;
      const categoryName =
        (product.cust_categories && product.cust_categories.name) ||
        "Tidak ada kategori";
      const mainImage =
        product.image_url ||
        "https://via.placeholder.com/500x500/6c757d/ffffff?text=No+Image";

      const inCart = Utils.Cart.hasItem(productId);
      const cartQty = Utils.Cart.getQuantity(productId);

      // Store product data di data attributes biar ga ribet dengan quote
      const productData = JSON.stringify({
        id: productId,
        name: productName,
        price: productPrice,
        image: mainImage,
      }).replace(/"/g, "&quot;");

      html += `
                <div class="product-card" id="product-${productId}" data-product='${productData}'>
                    <div class="card-header">
                        <div class="card-header-left">
                            <div class="card-avatar">${Utils.sanitize(productName.charAt(0).toUpperCase())}</div>
                            <div class="card-username">Laqiy Isshoni Lucky Parfum</div>
                        </div>
                        <i class="fas fa-ellipsis-h"></i>
                    </div>

                    <div class="product-slider">
                        <div class="slider-container" id="slider-${productId}">
                            <img src="${mainImage}"
                                 alt="${Utils.sanitize(productName)}"
                                 class="product-image"
                                 onerror="this.src='https://via.placeholder.com/500x500/6c757d/ffffff?text=Image+Error'">
                        </div>
                        <div class="slider-indicators" id="indicators-${productId}">
                            <div class="indicator active"></div>
                        </div>
                    </div>

                    <div class="card-actions">
                        <div class="action-icons">
                            <i class="far fa-heart like-btn"
                               data-product-id="${productId}"></i>
                        </div>
                        <i class="far fa-bookmark"></i>
                    </div>

                    <div class="product-info">
                        <div class="likes-count" id="likes-count-${productId}">
                            ${(product.likes_count || 0).toLocaleString()} suka
                        </div>
                        <div class="product-name">${Utils.sanitize(productName)}</div>
                        <div class="product-category">Kategori: ${Utils.sanitize(categoryName)}</div>
                        <div class="product-description">
                            ${Utils.sanitize(product.short_description || "Deskripsi tidak tersedia")}
                        </div>
                    </div>

                    <div class="checkout-section">
                        <div class="price-row">
                            <div class="price">${Utils.formatRupiah(productPrice)}</div>
                            ${
                              inCart
                                ? `
                                <div class="quantity-selector" style="justify-content: flex-end;">
                                    <button class="qty-btn qty-minus" data-product-id="${productId}">
                                        <i class="fas fa-minus"></i>
                                    </button>
                                    <span class="qty-display" id="qty-display-${productId}">${cartQty}</span>
                                    <button class="qty-btn qty-plus" data-product-id="${productId}">
                                        <i class="fas fa-plus"></i>
                                    </button>
                                </div>
                            `
                                : ""
                            }
                        </div>
                        <div class="checkout-btns">
                            <button class="add-to-cart-btn ${inCart ? "added" : ""}"
                                    id="cart-btn-${productId}"
                                    data-product-id="${productId}"
                                    data-action="${inCart ? "remove" : "add"}">
                                ${inCart ? '<i class="fas fa-check"></i> Di Keranjang' : '<i class="fas fa-cart-plus"></i> Tambah ke Keranjang'}
                            </button>
                            <button class="checkout-btn" data-product-id="${productId}" data-action="buy">
                                Beli Langsung
                            </button>
                        </div>
                    </div>
                </div>
            `;
    });

    container.innerHTML = html;
  }

  // ============================================================
  // CART FUNCTIONS (localStorage-based)
  // ============================================================
  function addToCart(productId, productName, productPrice, productImage) {
    const result = Utils.Cart.add(
      {
        id: productId,
        name: productName,
        price: productPrice,
        image: productImage,
      },
      1,
    );

    if (result.total_items > 0) {
      updateCartUI();
      updateCartPreview();
      Utils.Toast.success("Produk berhasil ditambahkan ke keranjang!");
    }
  }

  function updateCartQuantity(productId, delta) {
    const result = Utils.Cart.updateQuantity(productId, delta);

    if (result.success) {
      if (result.quantity === 0) {
        removeCartItemUI(productId);
      } else {
        const qtyDisplay = document.getElementById(`qty-display-${productId}`);
        if (qtyDisplay) qtyDisplay.textContent = result.quantity;

        const cartBtn = document.getElementById(`cart-btn-${productId}`);
        if (cartBtn) {
          cartBtn.innerHTML = '<i class="fas fa-check"></i> Di Keranjang';
          cartBtn.classList.add("added");
          cartBtn.onclick = () => App.removeFromCart(productId);
        }
      }

      updateCartUI();
      updateCartPreview();

      const msg =
        delta > 0
          ? "Jumlah produk ditambah"
          : result.quantity > 0
            ? "Jumlah produk dikurangi"
            : "Produk dihapus dari keranjang";
      Utils.Toast.success(msg + "!");
    }
  }

  function removeFromCart(productId) {
    Utils.Cart.remove(productId);
    removeCartItemUI(productId);
    updateCartUI();
    updateCartPreview();
    Utils.Toast.success("Produk dihapus dari keranjang");
  }

  function clearCart() {
    if (!confirm("Yakin ingin mengosongkan keranjang?")) return;

    Utils.Cart.clear();
    updateCartUI();
    updateCartPreview();

    // Reset semua tombol produk
    document.querySelectorAll(".add-to-cart-btn").forEach((btn) => {
      btn.innerHTML = '<i class="fas fa-cart-plus"></i> Tambah ke Keranjang';
      btn.classList.remove("added");
    });

    // Sembunyikan quantity selector
    document
      .querySelectorAll(".quantity-selector")
      .forEach((el) => el.remove());

    Utils.Toast.success("Keranjang berhasil dikosongkan!");
  }

  function removeCartItemUI(productId) {
    const cartItem = document.querySelector(
      `.cart-preview-item[data-product-id="${productId}"]`,
    );
    if (cartItem) cartItem.remove();

    const cartBtn = document.getElementById(`cart-btn-${productId}`);
    if (cartBtn) {
      cartBtn.innerHTML =
        '<i class="fas fa-cart-plus"></i> Tambah ke Keranjang';
      cartBtn.classList.remove("added");
      cartBtn.onclick = () => {
        const product = state.products.find(
          (p) => String(p.id) === String(productId),
        );
        if (product) {
          App.addToCart(
            productId,
            product.name,
            product.price,
            product.image_url || "",
          );
        }
      };
    }

    // Hapus quantity selector jika ada
    const qtySelector = document.querySelector(
      `#product-${productId} .quantity-selector`,
    );
    if (qtySelector) qtySelector.remove();
  }

  function updateCartUI() {
    const count = Utils.Cart.getTotalItems();
    const cartCount = document.getElementById("cart-count");
    if (cartCount) cartCount.textContent = count;
  }

  function updateCartPreview() {
    const items = Utils.Cart.getItems();
    const body = document.getElementById("cart-preview-body");
    const footer = document.querySelector(".cart-preview-footer");
    const clearBtn = document.querySelector(".clear-cart-btn");

    if (!body) return;

    if (items.length === 0) {
      body.innerHTML = `
                <div class="cart-preview-empty">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Keranjang belanja kosong</p>
                </div>
            `;
      if (footer) footer.style.display = "none";
      if (clearBtn) clearBtn.disabled = true;
      return;
    }

    let html = "";
    items.forEach((item) => {
      html += `
                <div class="cart-preview-item" data-product-id="${item.id}">
                    <div class="cart-preview-img" style="background-image: url('${item.image}')"></div>
                    <div class="cart-preview-details">
                        <div class="cart-preview-name">${Utils.sanitize(item.name)}</div>
                        <div class="cart-preview-qty">
                            <button class="cart-preview-qty-btn" onclick="App.updateCartQuantity('${item.id}', -1)">
                                <i class="fas fa-minus"></i>
                            </button>
                            <span class="cart-preview-qty-display">${item.quantity}</span>
                            <button class="cart-preview-qty-btn" onclick="App.updateCartQuantity('${item.id}', 1)">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="cart-preview-price">${Utils.formatRupiah(item.price * item.quantity)}</div>
                </div>
            `;
    });

    body.innerHTML = html;

    const total = Utils.Cart.getTotalPrice();
    const totalEl = document.getElementById("cart-preview-total");
    if (totalEl) totalEl.textContent = Utils.formatRupiah(total);

    const checkoutBtn = document.querySelector(".cart-preview-checkout");
    if (checkoutBtn) {
      checkoutBtn.textContent = `Checkout (${Utils.Cart.getTotalItems()} item)`;
    }

    if (footer) footer.style.display = "block";
    if (clearBtn) clearBtn.disabled = false;
  }

  function toggleCartPreview(event) {
    event.preventDefault();
    const preview = document.getElementById("cart-preview");
    if (preview) {
      if (preview.style.display === "block") {
        preview.style.display = "none";
      } else {
        updateCartPreview();
        preview.style.display = "block";
      }
    }
  }

  // ============================================================
  // CHECKOUT FUNCTIONS
  // ============================================================
  function openSingleCheckout(
    productId,
    productName,
    productPrice,
    productImage,
  ) {
    state.checkoutType = "single";
    state.currentProductId = productId;
    state.currentProductName = productName;
    state.currentProductPrice = productPrice;
    state.currentProductImage = productImage;

    document.getElementById("checkout-type").value = "single";
    document.getElementById("checkout-product-id").value = productId;
    document.getElementById("checkout-product-name").textContent = productName;
    document.getElementById("checkout-product-price").textContent =
      Utils.formatRupiah(productPrice);
    document.getElementById("summary-product-price").textContent =
      Utils.formatRupiah(productPrice);
    document.getElementById("summary-total").textContent =
      Utils.formatRupiah(productPrice);

    const thumbnail = document.getElementById("checkout-thumbnail");
    thumbnail.style.backgroundImage = `url('${productImage}')`;
    thumbnail.style.backgroundSize = "cover";
    thumbnail.style.backgroundPosition = "center";

    document.getElementById("single-product-info").style.display = "block";
    document.getElementById("cart-items-list").style.display = "none";

    openCheckout();
  }

  function openCheckoutFromCart() {
    const items = Utils.Cart.getItems();
    if (items.length === 0) {
      Utils.Toast.error("Keranjang belanja kosong");
      return;
    }

    state.checkoutType = "cart";
    state.currentProducts = items;

    document.getElementById("checkout-type").value = "cart";
    document.getElementById("single-product-info").style.display = "none";
    document.getElementById("cart-items-list").style.display = "block";

    populateCartItemsInCheckout(items);
    updateOrderSummaryForCart(items);

    openCheckout();
  }

  function populateCartItemsInCheckout(items) {
    const list = document.getElementById("cart-items-list");
    if (!list) return;

    let html = '<div class="form-label">Produk dalam Keranjang</div>';

    items.forEach((item) => {
      const itemTotal = item.price * item.quantity;
      html += `
                <div class="checkout-item" data-product-id="${item.id}">
                    <div class="checkout-item-img" style="background-image: url('${item.image}')"></div>
                    <div class="checkout-item-details">
                        <div class="checkout-item-name">${Utils.sanitize(item.name)}</div>
                        <div class="checkout-item-qty"><span>Jumlah: ${item.quantity}</span></div>
                    </div>
                    <div class="checkout-item-price">${Utils.formatRupiah(itemTotal)}</div>
                </div>
            `;
    });

    list.innerHTML = html;
  }

  function openCheckout() {
    // Reset form
    document.getElementById("customer-name").value = "";
    document.getElementById("customer-phone").value = "";
    document.getElementById("customer-address").value = "";
    document.getElementById("gps-search").value = "";

    // Reset ke pickup
    state.deliveryOption = "pickup";
    document.getElementById("pickup-option").classList.add("active");
    document.getElementById("delivery-option").classList.remove("active");
    document.getElementById("shipping-section").style.display = "none";
    document.getElementById("shipping-row").style.display = "none";

    state.shippingCost = 15000;
    state.shippingType = "regular";

    toggleAddressInput("manual");

    const gpsResults = document.getElementById("gps-results");
    if (gpsResults) {
      gpsResults.innerHTML =
        '<div class="gps-loading"><i class="fas fa-spinner spinner"></i>Memuat data lokasi...</div>';
    }

    document.getElementById("gps-status").style.display = "none";
    document.getElementById("accuracy-warning").style.display = "none";

    updateOrderSummary();

    document.getElementById("checkout-overlay").style.display = "block";
    document.getElementById("checkout-card").style.display = "block";
    document.getElementById("cart-preview").style.display = "none";
  }

  function closeCheckout() {
    document.getElementById("checkout-overlay").style.display = "none";
    document.getElementById("checkout-card").style.display = "none";
  }

  function selectDeliveryOption(option) {
    state.deliveryOption = option;

    document.getElementById("pickup-option").classList.remove("active");
    document.getElementById("delivery-option").classList.remove("active");

    if (option === "pickup") {
      document.getElementById("pickup-option").classList.add("active");
      document.getElementById("shipping-section").style.display = "none";
      document.getElementById("shipping-row").style.display = "none";
    } else {
      document.getElementById("delivery-option").classList.add("active");
      document.getElementById("shipping-section").style.display = "block";
      document.getElementById("shipping-row").style.display = "flex";
    }

    updateOrderSummary();
  }

  function updateOrderSummary() {
    let total = 0;

    if (state.checkoutType === "single") {
      total = state.currentProductPrice;
    } else if (
      state.checkoutType === "cart" &&
      state.currentProducts.length > 0
    ) {
      state.currentProducts.forEach((item) => {
        total += item.price * item.quantity;
      });
    }

    if (state.deliveryOption === "delivery") {
      document.getElementById("summary-shipping").textContent =
        Utils.formatRupiah(state.shippingCost);
      total += state.shippingCost;
      document.getElementById("shipping-row").style.display = "flex";
    } else {
      document.getElementById("shipping-row").style.display = "none";
    }

    document.getElementById("summary-total").textContent =
      Utils.formatRupiah(total);
  }

  function updateOrderSummaryForCart(items) {
    let productTotal = 0;
    items.forEach((item) => {
      productTotal += item.price * item.quantity;
    });

    document.getElementById("summary-product-price").textContent =
      Utils.formatRupiah(productTotal);

    state.shippingCost = 15000;
    state.shippingType = "regular";

    document
      .querySelectorAll(".shipping-item")
      .forEach((item) => item.classList.remove("active"));
    const regularShipping = document.querySelector(
      ".shipping-item:first-child",
    );
    if (regularShipping) regularShipping.classList.add("active");

    document.getElementById("shipping-section").style.display = "none";
    document.getElementById("shipping-row").style.display = "none";

    state.deliveryOption = "pickup";
    document.getElementById("pickup-option").classList.add("active");
    document.getElementById("delivery-option").classList.remove("active");

    updateOrderSummary();
  }

  function selectShipping(type, cost, el) {
    state.shippingType = type;
    state.shippingCost = cost;

    document
      .querySelectorAll(".shipping-item")
      .forEach((item) => item.classList.remove("active"));
    if (el) el.classList.add("active");

    updateOrderSummary();
  }

  // ============================================================
  // SUBMIT ORDER
  // ============================================================
  async function submitOrder() {
    const name = document.getElementById("customer-name").value.trim();
    const phone = document.getElementById("customer-phone").value.trim();
    const address = document.getElementById("customer-address").value.trim();

    if (!name || !phone || !address) {
      Utils.Toast.error("Harap lengkapi semua data yang diperlukan!");
      return;
    }

    if (!Utils.isValidPhone(phone)) {
      Utils.Toast.error("Nomor WhatsApp tidak valid! (10-13 digit)");
      return;
    }

    if (state.checkoutType === "single") {
      await submitSingleOrder(name, phone, address);
    } else {
      await submitCartOrder(name, phone, address);
    }
  }

  async function submitSingleOrder(name, phone, address) {
    let total = state.currentProductPrice;
    let shippingCostForOrder = 0;
    let deliveryInfo = "Order di tempat (ambil di gerai/pameran)";

    if (state.deliveryOption === "delivery") {
      shippingCostForOrder = state.shippingCost;
      total += state.shippingCost;
      deliveryInfo = `Dikirim (${state.shippingType}) - ${Utils.formatRupiah(state.shippingCost)}`;
    }

    try {
      const result = await SUPABASE.request("orders", "POST", {
        product_id: state.currentProductId,
        product_name: state.currentProductName,
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        delivery_method: state.deliveryOption,
        shipping_type:
          state.deliveryOption === "delivery" ? state.shippingType : "",
        shipping_cost: shippingCostForOrder,
        total_price: total,
        status: "pending",
        order_date: new Date().toISOString(),
      });

      if (result.success) {
        // Kurangi stok
        reduceProductStock(state.currentProductId, 1);

        // WhatsApp message
        const message =
          `Halo, saya ingin memesan:\n\n` +
          `Produk: ${state.currentProductName}\n` +
          `Harga: ${Utils.formatRupiah(state.currentProductPrice)}\n` +
          `Metode: ${deliveryInfo}\n` +
          `Total: ${Utils.formatRupiah(total)}\n\n` +
          `Data Diri:\n` +
          `Nama: ${name}\n` +
          `WhatsApp: ${phone}\n` +
          `Alamat: ${address}`;

        window.open(
          `https://wa.me/?text=${encodeURIComponent(message)}`,
          "_blank",
        );

        showSuccessModal(
          `Pesanan Anda telah berhasil dibuat!<br><br>` +
            `Produk: ${state.currentProductName}<br>` +
            `Total: ${Utils.formatRupiah(total)}<br><br>` +
            `Kami akan menghubungi Anda via WhatsApp untuk konfirmasi lebih lanjut.`,
        );

        closeCheckout();
      } else {
        Utils.Toast.error(
          "Gagal menyimpan pesanan: " + (result.error || "Unknown error"),
        );
      }
    } catch (error) {
      console.error("[App] Submit order error:", error);
      Utils.Toast.error("Terjadi kesalahan saat menyimpan pesanan.");
    }
  }

  async function submitCartOrder(name, phone, address) {
    if (!state.currentProducts || state.currentProducts.length === 0) {
      Utils.Toast.error("Keranjang belanja kosong");
      return;
    }

    let total = 0;
    state.currentProducts.forEach((item) => {
      total += item.price * item.quantity;
    });

    let shippingCostForOrder = 0;
    let deliveryInfo = "Order di tempat (ambil di gerai/pameran)";

    if (state.deliveryOption === "delivery") {
      shippingCostForOrder = state.shippingCost;
      total += state.shippingCost;
      deliveryInfo = `Dikirim (${state.shippingType}) - ${Utils.formatRupiah(state.shippingCost)}`;
    }

    try {
      // Simpan order via JSON ke Supabase
      const result = await SUPABASE.request("orders", "POST", {
        customer_name: name,
        customer_phone: phone,
        customer_address: address,
        delivery_method: state.deliveryOption,
        shipping_type:
          state.deliveryOption === "delivery" ? state.shippingType : "",
        shipping_cost: shippingCostForOrder,
        total_price: total,
        status: "pending",
        products: state.currentProducts.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        order_date: new Date().toISOString(),
      });

      if (result.success) {
        // Kurangi stok untuk setiap produk
        state.currentProducts.forEach((item) => {
          reduceProductStock(item.id, item.quantity);
        });

        // WhatsApp message
        let message = `Halo, saya ingin memesan:\n\n`;
        state.currentProducts.forEach((item) => {
          const itemTotal = item.price * item.quantity;
          message += `• ${item.name} (${item.quantity}x)\n`;
          message += `  ${Utils.formatRupiah(item.price)} x ${item.quantity}\n`;
          message += `  Subtotal: ${Utils.formatRupiah(itemTotal)}\n\n`;
        });

        message += `Metode: ${state.deliveryOption === "pickup" ? "Order di tempat" : `Dikirim (${state.shippingType})`}\n`;
        if (state.deliveryOption === "delivery") {
          message += `Ongkir: ${Utils.formatRupiah(state.shippingCost)}\n`;
        }
        message += `Total: ${Utils.formatRupiah(total)}\n\n`;
        message += `Data Diri:\nNama: ${name}\nWhatsApp: ${phone}\nAlamat: ${address}`;

        window.open(
          `https://wa.me/?text=${encodeURIComponent(message)}`,
          "_blank",
        );

        // Kosongkan cart
        Utils.Cart.clear();

        showSuccessModal(
          `Pesanan Anda telah berhasil dibuat!<br><br>` +
            `Total: ${Utils.formatRupiah(total)}<br>` +
            `${state.currentProducts.length} produk<br><br>` +
            `Kami akan menghubungi Anda via WhatsApp untuk konfirmasi lebih lanjut.`,
        );

        closeCheckout();
        updateCartUI();
      } else {
        Utils.Toast.error(
          "Gagal menyimpan pesanan: " + (result.error || "Unknown error"),
        );
      }
    } catch (error) {
      console.error("[App] Submit cart order error:", error);
      Utils.Toast.error("Terjadi kesalahan saat menyimpan pesanan.");
    }
  }

  async function reduceProductStock(productId, quantity) {
    try {
      const result = await SUPABASE.request("cust_products", "GET", null, {
        select: "id,stock",
        id: `eq.${productId}`,
        limit: "1",
      });

      if (result.success && result.data && result.data.length > 0) {
        const currentStock = parseInt(result.data[0].stock) || 0;
        const newStock = Math.max(0, currentStock - quantity);

        await SUPABASE.request(
          "cust_products",
          "PATCH",
          {
            stock: newStock,
          },
          { id: `eq.${productId}` },
        );
      }
    } catch (error) {
      console.error("[App] Reduce stock error:", error);
    }
  }

  function showSuccessModal(message) {
    document.getElementById("success-message").innerHTML = message;
    document.getElementById("success-modal").style.display = "flex";
  }

  function closeSuccessModal() {
    document.getElementById("success-modal").style.display = "none";
  }

  // ============================================================
  // LIKES
  // ============================================================
  function toggleLike(icon, productId) {
    const isLiked = icon.classList.contains("fas");
    const countElement = document.getElementById(`likes-count-${productId}`);
    if (!countElement) return;

    // Animasi UI langsung
    if (isLiked) {
      icon.classList.remove("fas");
      icon.classList.add("far");
    } else {
      icon.classList.remove("far");
      icon.classList.add("fas");
    }

    icon.style.transform = "scale(1.3)";
    setTimeout(() => {
      icon.style.transform = "scale(1)";
    }, 300);

    // Update count sementara
    const currentCount =
      parseInt(countElement.textContent.replace(/[^\d]/g, "")) || 0;
    const newCount = isLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
    countElement.textContent = `${newCount.toLocaleString()} suka`;

    // Kirim ke Supabase
    updateLikeCount(icon, productId, isLiked ? -1 : 1, countElement);
  }

  async function updateLikeCount(icon, productId, delta, countElement) {
    try {
      // Ambil data terbaru
      const getResult = await SUPABASE.request("cust_products", "GET", null, {
        select: "id,likes_count",
        id: `eq.${productId}`,
        limit: "1",
      });

      if (
        !getResult.success ||
        !getResult.data ||
        getResult.data.length === 0
      ) {
        throw new Error("Produk tidak ditemukan");
      }

      const currentLikes = parseInt(getResult.data[0].likes_count) || 0;
      const newLikes =
        delta > 0 ? currentLikes + 1 : Math.max(0, currentLikes - 1);

      const updateResult = await SUPABASE.request(
        "cust_products",
        "PATCH",
        {
          likes_count: newLikes,
        },
        { id: `eq.${productId}` },
      );

      if (updateResult.success) {
        countElement.textContent = `${newLikes.toLocaleString()} suka`;
        Utils.Toast.success(
          delta > 0 ? "Produk berhasil disukai!" : "Like berhasil dibatalkan!",
        );
      } else {
        throw new Error("Gagal update");
      }
    } catch (error) {
      console.error("[App] Like update error:", error);
      // Revert
      if (delta > 0) {
        icon.classList.remove("fas");
        icon.classList.add("far");
      } else {
        icon.classList.remove("far");
        icon.classList.add("fas");
      }
      Utils.Toast.error("Gagal menyimpan like");
    }
  }

  // ============================================================
  // FILTER & SEARCH
  // ============================================================
  function filterByCategory(categoryId) {
    state.categoryFilter = categoryId;
    Utils.setUrlParam("category", categoryId);
    renderCategories();
    renderProducts();
  }

  function searchProducts(query) {
    state.searchQuery = query.trim();
    Utils.setUrlParam("search", state.searchQuery);
    renderProducts();
  }

  // ============================================================
  // GPS & ADDRESS
  // ============================================================
  function toggleAddressInput(method) {
    document.getElementById("manual-btn").classList.remove("active");
    document.getElementById("gps-btn").classList.remove("active");
    document.getElementById("manual-address").classList.remove("active");
    document.getElementById("gps-address").classList.remove("active");

    if (method === "manual") {
      document.getElementById("manual-btn").classList.add("active");
      document.getElementById("manual-address").classList.add("active");
      document.getElementById("customer-address").required = true;
    } else {
      document.getElementById("gps-btn").classList.add("active");
      document.getElementById("gps-address").classList.add("active");
      document.getElementById("customer-address").required = false;
      setTimeout(() => detectLocation(), 300);
    }
  }

  function selectGPSMethod(method, el) {
    state.gpsMethod = method;
    document
      .querySelectorAll(".gps-method-btn")
      .forEach((btn) => btn.classList.remove("active"));
    if (el) el.classList.add("active");

    const citySelection = document.getElementById("city-selection");
    if (method === "city") {
      citySelection.style.display = "block";
    } else {
      citySelection.style.display = "none";
      detectLocation();
    }
  }

  function selectCity(city, el) {
    document
      .querySelectorAll(".city-btn")
      .forEach((btn) => btn.classList.remove("active"));
    if (el) el.classList.add("active");

    const statusElement = document.getElementById("gps-status");
    statusElement.style.display = "flex";
    document.getElementById("gps-location-name").textContent =
      `Kota ${city.name}`;
    document.getElementById("gps-location-address").textContent =
      `Provinsi ${city.province}`;
    document.getElementById("gps-location-source").textContent =
      "Sumber: Pilihan Manual";
    state.selectedAddress = `${city.name}, ${city.province}`;

    loadCityLocations(city.id);

    document.getElementById("accuracy-warning").style.display = "flex";
    document.getElementById("warning-text").textContent =
      "Lokasi berdasarkan kota yang dipilih. Periksa alamat sebelum digunakan.";
  }

  function detectLocation() {
    const statusElement = document.getElementById("gps-status");
    const resultsElement = document.getElementById("gps-results");
    if (!statusElement || !resultsElement) return;

    statusElement.style.display = "flex";
    document.getElementById("gps-location-name").textContent =
      "Mendeteksi lokasi...";
    document.getElementById("gps-location-address").textContent =
      "Sedang mengambil data...";
    document.getElementById("gps-location-source").textContent =
      "Sumber: GPS Device";
    resultsElement.innerHTML =
      '<div class="gps-loading"><i class="fas fa-spinner spinner"></i>Mendeteksi lokasi Anda...</div>';

    detectWithGPS();
  }

  function detectWithGPS() {
    if (!navigator.geolocation) {
      showLocationError(
        "Browser tidak mendukung geolocation",
        "Silakan gunakan input alamat manual",
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async function (position) {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
          );
          const data = await response.json();

          if (data && data.address) {
            const address = data.address;
            let locationName =
              address.city ||
              address.town ||
              address.village ||
              address.municipality ||
              "Lokasi Anda";
            const addressParts = [];
            if (address.road) addressParts.push(address.road);
            if (address.suburb) addressParts.push(address.suburb);
            if (address.city_district) addressParts.push(address.city_district);
            if (address.city || address.town)
              addressParts.push(address.city || address.town);
            if (address.state) addressParts.push(address.state);
            if (address.country) addressParts.push(address.country);
            const fullAddress = addressParts.join(", ");

            document.getElementById("gps-location-name").textContent =
              locationName;
            document.getElementById("gps-location-address").textContent =
              fullAddress;
            document.getElementById("gps-location-source").textContent =
              `Sumber: GPS Device (Akurasi: ±${Math.round(accuracy)} meter)`;

            const warningElement = document.getElementById("accuracy-warning");
            if (accuracy > 100) {
              warningElement.style.display = "flex";
              document.getElementById("warning-text").textContent =
                `Akurasi GPS ±${Math.round(accuracy)} meter. Periksa alamat sebelum digunakan.`;
            } else {
              warningElement.style.display = "none";
            }

            state.selectedAddress =
              fullAddress || `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
            document.getElementById("gps-results").innerHTML = "";
          }
        } catch (error) {
          console.error("Reverse geocoding error:", error);
          document.getElementById("gps-location-name").textContent =
            "Lokasi Anda";
          document.getElementById("gps-location-address").textContent =
            `Koordinat: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
          document.getElementById("gps-location-source").textContent =
            `Sumber: GPS Device (Akurasi: ±${Math.round(accuracy)} meter)`;
          document.getElementById("accuracy-warning").style.display = "flex";
          document.getElementById("warning-text").textContent =
            "Tidak dapat mendapatkan nama lokasi. Koordinat GPS digunakan.";
          state.selectedAddress = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        }
      },
      function (error) {
        let errorMessage = "Gagal mendapatkan lokasi GPS";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage =
              "Izin lokasi GPS ditolak. Silakan izinkan akses lokasi di browser settings.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = "GPS tidak tersedia pada perangkat ini";
            break;
          case error.TIMEOUT:
            errorMessage = "Timeout mendapatkan lokasi GPS";
            break;
        }
        showLocationError(errorMessage, "Silakan gunakan input alamat manual");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }

  function showLocationError(message, suggestion) {
    document.getElementById("gps-location-name").textContent =
      "Gagal Mendeteksi Lokasi";
    document.getElementById("gps-location-address").textContent = message;
    document.getElementById("gps-location-source").textContent =
      suggestion || "";
    const resultsElement = document.getElementById("gps-results");
    resultsElement.innerHTML = `<div class="gps-loading"><i class="fas fa-exclamation-triangle"></i><div>${message}</div>${suggestion ? `<div style="margin-top:5px;font-size:12px;">${suggestion}</div>` : ""}</div>`;
    document.getElementById("accuracy-warning").style.display = "flex";
    document.getElementById("warning-text").textContent =
      "Gagal mendapatkan lokasi akurat. Silakan gunakan input alamat manual.";
  }

  function loadCityLocations(cityId) {
    const resultsElement = document.getElementById("gps-results");
    if (!resultsElement) return;

    resultsElement.innerHTML =
      '<div class="gps-loading"><i class="fas fa-spinner spinner"></i>Memuat tempat terdekat...</div>';

    setTimeout(() => {
      let results = locationData[cityId] || [];
      if (results.length === 0) {
        for (const city in locationData) {
          results = results.concat(locationData[city]);
        }
        results = results.slice(0, 8);
      }

      if (results.length > 0) {
        let html = "";
        results.forEach((place) => {
          html += `<div class="gps-result-item" onclick="App.selectGPSLocation('${place.name.replace(/'/g, "\\'")}', '${place.address.replace(/'/g, "\\'")}')">
                        <div class="gps-result-name">${place.name}</div>
                        <div class="gps-result-address">${place.address}</div>
                        <div class="gps-result-distance">${place.distance}</div>
                    </div>`;
        });
        resultsElement.innerHTML = html;
      } else {
        resultsElement.innerHTML =
          '<div class="gps-loading">Tidak ditemukan tempat terdekat.</div>';
      }
    }, 1000);
  }

  function searchAddress() {
    const searchTerm = document.getElementById("gps-search").value.trim();
    const resultsElement = document.getElementById("gps-results");
    if (!resultsElement) return;

    resultsElement.innerHTML =
      '<div class="gps-loading"><i class="fas fa-spinner spinner"></i>Mencari...</div>';

    setTimeout(async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchTerm)}&limit=5&countrycodes=id`,
        );
        const data = await response.json();

        if (data.length > 0) {
          let html = "";
          data.forEach((place) => {
            const displayName = place.display_name.replace(/'/g, "\\'");
            html += `<div class="gps-result-item" onclick="App.selectGPSLocation('${place.display_name.split(",")[0].replace(/'/g, "\\'")}', '${displayName}')">
                            <div class="gps-result-name">${place.display_name.split(",")[0]}</div>
                            <div class="gps-result-address">${place.display_name}</div>
                        </div>`;
          });
          resultsElement.innerHTML = html;
        } else {
          resultsElement.innerHTML =
            '<div class="gps-loading">Tidak ditemukan hasil untuk pencarian ini.</div>';
        }
      } catch (error) {
        resultsElement.innerHTML =
          '<div class="gps-loading">Gagal melakukan pencarian.</div>';
      }
    }, 800);
  }

  function selectGPSLocation(name, address) {
    document.getElementById("gps-location-name").textContent = name;
    document.getElementById("gps-location-address").textContent = address;
    document.getElementById("gps-location-source").textContent =
      "Sumber: Pencarian Manual";
    document.getElementById("gps-status").style.display = "flex";
    state.selectedAddress = address;
    document.getElementById("accuracy-warning").style.display = "flex";
    document.getElementById("warning-text").textContent =
      "Alamat dipilih dari hasil pencarian. Periksa sebelum digunakan.";

    document
      .querySelectorAll("#gps-results .gps-result-item")
      .forEach((item) => {
        item.style.backgroundColor = "";
        item.style.border = "";
      });
    if (event && event.currentTarget) {
      event.currentTarget.style.backgroundColor = "#f0f8ff";
      event.currentTarget.style.border = "1px solid #0095f6";
    }
  }

  function useGPSLocation() {
    const address = document.getElementById("gps-location-address").textContent;
    if (address && address !== "Sedang mengambil data...") {
      document.getElementById("customer-address").value = address;
      toggleAddressInput("manual");
    }
  }

  function populateCityGrid() {
    const cityGrid = document.getElementById("city-grid");
    if (!cityGrid) return;
    cityGrid.innerHTML = "";
    cities.forEach((city) => {
      const btn = document.createElement("div");
      btn.className = "city-btn";
      btn.innerHTML = `<div class="city-name">${city.name}</div>`;
      btn.onclick = () => App.selectCity(city, btn);
      cityGrid.appendChild(btn);
    });
  }

  function attachEventListeners() {
    const searchBar = document.querySelector(".search-bar");
    if (searchBar) {
      searchBar.addEventListener("keypress", function (e) {
        if (e.key === "Enter") searchProducts(this.value);
      });
      if (state.searchQuery) searchBar.value = state.searchQuery;
    }

    const gpsSearch = document.getElementById("gps-search");
    if (gpsSearch) {
      gpsSearch.addEventListener("keypress", function (e) {
        if (e.key === "Enter") searchAddress();
      });
    }

    const searchForm = document.getElementById("searchForm");
    if (searchForm) {
      searchForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const input = this.querySelector(".search-bar");
        if (input) searchProducts(input.value);
      });
    }

    // EVENT DELEGATION: Semua tombol dalam products-container
    const container = document.getElementById("products-container");
    if (container) {
      container.addEventListener("click", function (e) {
        const target = e.target.closest("button");
        if (!target) return;

        const productId = target.dataset.productId;
        const action = target.dataset.action;

        // Ambil data produk dari parent card
        const card = target.closest(".product-card");
        let product = null;
        if (card && card.dataset.product) {
          try {
            product = JSON.parse(card.dataset.product);
          } catch (ex) {
            product = null;
          }
        }

        if (action === "add" && product) {
          addToCart(product.id, product.name, product.price, product.image);
        } else if (action === "remove" && productId) {
          removeFromCart(productId);
        } else if (action === "buy" && product) {
          openSingleCheckout(
            product.id,
            product.name,
            product.price,
            product.image,
          );
        } else if (target.classList.contains("qty-minus") && productId) {
          updateCartQuantity(productId, -1);
        } else if (target.classList.contains("qty-plus") && productId) {
          updateCartQuantity(productId, 1);
        }
      });
    }

    // EVENT DELEGATION: Like buttons
    document.addEventListener("click", function (e) {
      const likeBtn = e.target.closest(".like-btn");
      if (likeBtn) {
        const pid = likeBtn.dataset.productId;
        if (pid) toggleLike(likeBtn, pid);
      }
    });
  }

  return {
    init,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    clearCart,
    toggleCartPreview,
    openSingleCheckout,
    openCheckoutFromCart,
    closeCheckout,
    selectDeliveryOption,
    selectShipping,
    submitOrder,
    closeSuccessModal,
    toggleLike,
    filterByCategory,
    toggleAddressInput,
    selectGPSMethod,
    selectCity,
    searchAddress,
    selectGPSLocation,
    useGPSLocation,
    detectLocation,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
