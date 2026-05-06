// supabase.js - Supabase Client untuk Browser (Vanilla JS)
// ============================================================
// Menggantikan config.php + fungsi supabase() dari PHP
// Langsung dari browser ke Supabase REST API
// ============================================================

const SUPABASE = (() => {
    const SUPABASE_URL = 'https://iukwrvjdjdzurctlotea.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1a3dydmpkamR6dXJjdGxvdGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc5NjA5ODIsImV4cCI6MjA4MzUzNjk4Mn0.WBdE54hxNVb_TjDU--L0NnlBUm8eCChheTyZykc0K-0';

    /**
     * Request ke Supabase REST API
     * @param {string} endpoint - Nama tabel (misal: 'cust_products', 'orders')
     * @param {string} method - GET, POST, PATCH, DELETE
     * @param {object|null} data - Body untuk POST/PATCH
     * @param {object|null} filters - Query params (select, order, limit, dll)
     * @returns {Promise<object>} { success, data, error }
     */
    async function request(endpoint, method = 'GET', data = null, filters = null) {
        try {
            let url = `${SUPABASE_URL}/rest/v1/${endpoint}`;

            // Build query string dari filters
            if (filters) {
                const params = new URLSearchParams();
                for (const [key, value] of Object.entries(filters)) {
                    params.append(key, value);
                }
                const qs = params.toString();
                if (qs) url += `?${qs}`;
            }

            const headers = {
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Content-Type': 'application/json',
            };

            // Untuk GET count, perlu header Accept khusus
            if (filters && filters.select === 'count') {
                headers['Accept'] = 'application/json';
                headers['Prefer'] = 'count=exact';
            }

            // Untuk POST/PATCH, minta return data
            if (method === 'POST' || method === 'PATCH') {
                headers['Prefer'] = 'return=representation';
            }

            const options = {
                method,
                headers,
            };

            if (data && (method === 'POST' || method === 'PATCH')) {
                options.body = JSON.stringify(data);
            }

            console.log(`[Supabase] ${method} ${url}`);

            const response = await fetch(url, options);

            // Handle count query
            if (filters && filters.select === 'count') {
                const count = parseInt(response.headers.get('content-range')?.split('/')[1] || '0');
                return {
                    success: response.ok,
                    data: [{ count }],
                    error: null,
                };
            }

            // Handle empty response (DELETE, PATCH tanpa return)
            const text = await response.text();
            let resultData = text ? JSON.parse(text) : null;

            if (!response.ok) {
                console.error('[Supabase] Error:', response.status, resultData);
                return {
                    success: false,
                    data: null,
                    error: resultData?.message || `HTTP ${response.status}: ${response.statusText}`,
                    code: response.status,
                };
            }

            return {
                success: true,
                data: resultData || [],
                error: null,
            };
        } catch (error) {
            console.error('[Supabase] Network Error:', error);
            return {
                success: false,
                data: null,
                error: error.message || 'Network error',
            };
        }
    }

    /**
     * Multiple requests parallel (menggantikan supabase_multi dari PHP)
     * @param {Array<object>} requests - Array dari { endpoint, method, data, filters }
     * @returns {Promise<Array<object>>} Array hasil sesuai urutan request
     */
    async function multi(requests) {
        const promises = requests.map(req =>
            request(req.endpoint, req.method, req.data || null, req.filters || null)
        );
        return Promise.all(promises);
    }

    /**
     * Upload file ke Supabase Storage
     * @param {string} bucket - Nama bucket
     * @param {string} path - Path di bucket
     * @param {File|Blob} file - File yang akan diupload
     * @returns {Promise<object>} { success, url, error }
     */
    async function upload(bucket, path, file) {
        try {
            const url = `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                },
                body: file,
            });

            if (!response.ok) {
                const errorText = await response.text();
                return { success: false, error: errorText, url: null };
            }

            const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
            return { success: true, url: publicUrl, error: null };
        } catch (error) {
            return { success: false, error: error.message, url: null };
        }
    }

    /**
     * Dapatkan public URL untuk file di storage
     * @param {string} bucket - Nama bucket
     * @param {string} path - Path file
     * @returns {string} Public URL
     */
    function getPublicUrl(bucket, path) {
        if (!path) return 'https://via.placeholder.com/500x500/6c757d/ffffff?text=No+Image';
        if (path.startsWith('http')) return path;
        return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    }

    return {
        request,
        multi,
        upload,
        getPublicUrl,
        URL: SUPABASE_URL,
        KEY: SUPABASE_KEY,
    };
})();
