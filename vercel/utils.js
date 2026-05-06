// utils.js - Helper Functions untuk Store
// ============================================================

const Utils = (() => {
    'use strict';

    /**
     * Format angka ke Rupiah
     * @param {number} amount
     * @returns {string} Contoh: Rp 1.250.000
     */
    function formatRupiah(amount) {
        if (amount === null || amount === undefined || isNaN(amount)) {
            return 'Rp 0';
        }
        return `Rp ${Number(amount).toLocaleString('id-ID')}`;
    }

    /**
     * Format tanggal ke format Indonesia
     * @param {string|Date} date
     * @returns {string} Contoh: 25 Januari 2025
     */
    function formatDate(date) {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    }

    /**
     * Format tanggal + jam
     * @param {string|Date} date
     * @returns {string} Contoh: 25 Jan 2025, 14:30
     */
    function formatDateTime(date) {
        if (!date) return '-';
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return d.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    }

    /**
     * Format nomor HP
     * @param {string} phone
     * @returns {string} Contoh: 0812-3456-7890
     */
    function formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length <= 4) return cleaned;
        if (cleaned.length <= 8) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
    }

    /**
     * Validasi nomor HP Indonesia (10-13 digit)
     * @param {string} phone
     * @returns {boolean}
     */
    function isValidPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        return /^[0-9]{10,13}$/.test(cleaned);
    }

    /**
     * Sanitasi HTML (cegah XSS)
     * @param {string} str
     * @returns {string}
     */
    function sanitize(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Debounce function
     * @param {Function} func
     * @param {number} wait - milliseconds
     * @returns {Function}
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Dapatkan parameter URL
     * @param {string} name - Nama parameter
     * @returns {string|null}
     */
    function getUrlParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    }

    /**
     * Set parameter URL tanpa reload
     * @param {string} name
     * @param {string} value
     */
    function setUrlParam(name, value) {
        const url = new URL(window.location);
        if (value) {
            url.searchParams.set(name, value);
        } else {
            url.searchParams.delete(name);
        }
        window.history.replaceState({}, '', url);
    }

    /**
     * Cart Management - localStorage
     */
    const Cart = {
        _key: 'parfum_cart',

        /**
         * Dapatkan semua item cart dari localStorage
         * @returns {Array}
         */
        getItems() {
            try {
                const data = localStorage.getItem(this._key);
                return data ? JSON.parse(data) : [];
            } catch {
                return [];
            }
        },

        /**
         * Simpan cart ke localStorage
         * @param {Array} items
         */
        _save(items) {
            localStorage.setItem(this._key, JSON.stringify(items));
        },

        /**
         * Tambah produk ke cart
         * @param {object} product - { id, name, price, image }
         * @param {number} quantity
         * @returns {object} { success, total_items, cart_total }
         */
        add(product, quantity = 1) {
            const items = this.getItems();
            const existing = items.find(item => item.id === product.id);

            if (existing) {
                existing.quantity += quantity;
            } else {
                items.push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    image: product.image || '',
                    quantity,
                });
            }

            this._save(items);
            return this.getSummary();
        },

        /**
         * Update quantity produk
         * @param {string|number} productId
         * @param {number} delta - +/- number
         * @returns {object} { success, quantity, total_items, cart_total }
         */
        updateQuantity(productId, delta) {
            const items = this.getItems();
            const idx = items.findIndex(item => String(item.id) === String(productId));

            if (idx === -1) {
                return { success: false, quantity: 0, total_items: this.getTotalItems(), cart_total: this.getTotalPrice() };
            }

            const newQty = items[idx].quantity + delta;

            if (newQty <= 0) {
                items.splice(idx, 1);
            } else {
                items[idx].quantity = newQty;
            }

            this._save(items);
            const summary = this.getSummary();
            return {
                success: true,
                quantity: Math.max(0, newQty),
                total_items: summary.total_items,
                cart_total: summary.cart_total,
            };
        },

        /**
         * Hapus produk dari cart
         * @param {string|number} productId
         * @returns {object}
         */
        remove(productId) {
            const items = this.getItems().filter(item => String(item.id) !== String(productId));
            this._save(items);
            return this.getSummary();
        },

        /**
         * Kosongkan cart
         */
        clear() {
            localStorage.removeItem(this._key);
            return { total_items: 0, cart_total: 0 };
        },

        /**
         * Dapatkan jumlah total item
         * @returns {number}
         */
        getTotalItems() {
            return this.getItems().reduce((sum, item) => sum + item.quantity, 0);
        },

        /**
         * Dapatkan total harga
         * @returns {number}
         */
        getTotalPrice() {
            return this.getItems().reduce((sum, item) => sum + (item.price * item.quantity), 0);
        },

        /**
         * Dapatkan ringkasan cart
         * @returns {object} { total_items, cart_total }
         */
        getSummary() {
            return {
                total_items: this.getTotalItems(),
                cart_total: this.getTotalPrice(),
            };
        },

        /**
         * Cek apakah produk ada di cart
         * @param {string|number} productId
         * @returns {boolean}
         */
        hasItem(productId) {
            return this.getItems().some(item => String(item.id) === String(productId));
        },

        /**
         * Dapatkan quantity produk di cart
         * @param {string|number} productId
         * @returns {number}
         */
        getQuantity(productId) {
            const item = this.getItems().find(i => String(i.id) === String(productId));
            return item ? item.quantity : 0;
        },
    };

    /**
     * Toast Notification System
     */
    const Toast = {
        _container: null,

        _ensureContainer() {
            if (!this._container) {
                this._container = document.createElement('div');
                this._container.className = 'toast-container';
                document.body.appendChild(this._container);
            }
            return this._container;
        },

        /**
         * Tampilkan toast notification
         * @param {string} message
         * @param {'success'|'error'|'info'} type
         * @param {number} duration - ms
         */
        show(message, type = 'success', duration = 2500) {
            const container = this._ensureContainer();

            // Hapus toast sebelumnya
            const existing = container.querySelector('.toast');
            if (existing) {
                existing.style.animation = 'toastOut 0.2s ease forwards';
                setTimeout(() => existing.remove(), 200);
            }

            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                info: 'fa-info-circle',
            };

            const titles = {
                success: '✅ Berhasil!',
                error: '❌ Gagal!',
                info: 'ℹ️ Info',
            };

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <div class="toast-icon"><i class="fas ${icons[type] || icons.info}"></i></div>
                <div class="toast-content">
                    <div class="toast-title">${titles[type] || titles.info}</div>
                    <div class="toast-message">${message}</div>
                </div>
                <button class="toast-close" onclick="this.closest('.toast').remove()">
                    <i class="fas fa-times"></i>
                </button>
            `;

            container.appendChild(toast);

            setTimeout(() => {
                if (toast.parentNode) {
                    toast.style.animation = 'toastOut 0.2s ease forwards';
                    setTimeout(() => toast.remove(), 200);
                }
            }, duration);
        },

        success(msg, duration) { this.show(msg, 'success', duration); },
        error(msg, duration) { this.show(msg, 'error', duration); },
        info(msg, duration) { this.show(msg, 'info', duration); },
    };

    return {
        formatRupiah,
        formatDate,
        formatDateTime,
        formatPhone,
        isValidPhone,
        sanitize,
        debounce,
        getUrlParam,
        setUrlParam,
        Cart,
        Toast,
    };
})();
