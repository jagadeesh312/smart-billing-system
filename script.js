    // ==================== CONFIGURATION ====================
        const defaultConfig = {
            shop_name: 'Smart Billing System',
            upi_id: '8903559673@ybl'
        };

        let config = { ...defaultConfig };

        // Element SDK Integration
        if (window.elementSdk) {
            window.elementSdk.init({
                defaultConfig,
                onConfigChange: async (newConfig) => {
                    config = { ...config, ...newConfig };
                    updateShopDisplay();
                },
                mapToCapabilities: (config) => ({
                    recolorables: [],
                    borderables: [],
                    fontEditable: undefined,
                    fontSizeable: undefined
                }),
                mapToEditPanelValues: (config) => new Map([
                    ['shop_name', config.shop_name || defaultConfig.shop_name],
                    ['upi_id', config.upi_id || defaultConfig.upi_id]
                ])
            });
        }

        function updateShopDisplay() {
            const shopName = config.shop_name || defaultConfig.shop_name;
            document.getElementById('loginShopName').textContent = shopName;
            document.getElementById('adminShopName').textContent = shopName;
            document.getElementById('empShopName').textContent = shopName;
            if (document.getElementById('settingsShopName')) {
                document.getElementById('settingsShopName').value = shopName;
            }
            if (document.getElementById('settingsUpiId')) {
                document.getElementById('settingsUpiId').value = config.upi_id || defaultConfig.upi_id;
            }
        }

        // ==================== SAMPLE DATA ====================
    
fetch('data.php')
  .then(res => res.json())
  .then(data => {
      const sampleProducts = data.products;
      const sampleEmployees = data.employees;
      const sampleUsers = data.users;

      console.log(sampleProducts);
  });

        // ==================== STATE ====================
        let currentUser = null;
        let selectedRole = 'admin';
        let cart = { admin: [], emp: [] };
        let currentBillData = null;
        let currentPaymentContext = null;

        // ==================== LOCAL STORAGE ====================
        function initializeData() {
            if (!localStorage.getItem('sbs_products')) {
                localStorage.setItem('sbs_products', JSON.stringify(sampleProducts));
            }
            if (!localStorage.getItem('sbs_employees')) {
                localStorage.setItem('sbs_employees', JSON.stringify(sampleEmployees));
            }
            if (!localStorage.getItem('sbs_users')) {
                localStorage.setItem('sbs_users', JSON.stringify(sampleUsers));
            }
            if (!localStorage.getItem('sbs_sales')) {
                localStorage.setItem('sbs_sales', JSON.stringify([]));
            }
            if (!localStorage.getItem('sbs_settings')) {
                localStorage.setItem('sbs_settings', JSON.stringify({ shopName: config.shop_name, upiId: config.upi_id }));
            }
            if (!localStorage.getItem('sbs_billCounter')) {
                localStorage.setItem('sbs_billCounter', '1000');
            }
        }

        function getProducts() {
            return JSON.parse(localStorage.getItem('sbs_products')) || [];
        }

        function saveProducts(products) {
            localStorage.setItem('sbs_products', JSON.stringify(products));
        }

        function getEmployees() {
            return JSON.parse(localStorage.getItem('sbs_employees')) || [];
        }

        function saveEmployees(employees) {
            localStorage.setItem('sbs_employees', JSON.stringify(employees));
        }

        function getUsers() {
            return JSON.parse(localStorage.getItem('sbs_users')) || {};
        }

        function saveUsers(users) {
            localStorage.setItem('sbs_users', JSON.stringify(users));
        }

        function getSales() {
            return JSON.parse(localStorage.getItem('sbs_sales')) || [];
        }

        function saveSales(sales) {
            localStorage.setItem('sbs_sales', JSON.stringify(sales));
        }

        function getSettings() {
            return JSON.parse(localStorage.getItem('sbs_settings')) || { shopName: config.shop_name, upiId: config.upi_id };
        }

        function saveSettingsToStorage(settings) {
            localStorage.setItem('sbs_settings', JSON.stringify(settings));
        }

        function getNextBillNumber() {
            let counter = parseInt(localStorage.getItem('sbs_billCounter')) || 1000;
            counter++;
            localStorage.setItem('sbs_billCounter', counter.toString());
            return 'BILL-' + counter;
        }

        // ==================== TOAST NOTIFICATIONS ====================
        function showToast(message, type = 'info') {
            const container = document.getElementById('toastContainer');
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;
            
            const icons = {
                success: 'fa-check-circle',
                error: 'fa-exclamation-circle',
                info: 'fa-info-circle'
            };
            
            toast.innerHTML = `<i class="fas ${icons[type]}"></i> ${message}`;
            container.appendChild(toast);
            
            // Play sound
            playSound(type);
            
            setTimeout(() => {
                toast.style.animation = 'slideIn 0.3s ease reverse';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }

        function playSound(type) {
            // Create audio context for sound feedback
            try {
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const oscillator = audioContext.createOscillator();
                const gainNode = audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(audioContext.destination);
                
                const frequencies = {
                    success: 800,
                    error: 300,
                    info: 600
                };
                
                oscillator.frequency.value = frequencies[type] || 600;
                oscillator.type = 'sine';
                gainNode.gain.value = 0.1;
                
                oscillator.start();
                setTimeout(() => {
                    oscillator.stop();
                }, 100);
            } catch (e) {
                // Audio not supported
            }
        }

        // ==================== AUTHENTICATION ====================
        function selectRole(role) {
            selectedRole = role;
            document.querySelectorAll('.role-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.role === role);
            });
        }

        function handleLogin() {
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value.trim();
            
            if (!username || !password) {
                showToast('Please enter username and password', 'error');
                return;
            }
            
            const users = getUsers();
            const user = users[username];
            
            if (user && user.password === password && user.role === selectedRole) {
                currentUser = user;
                showToast(`Welcome, ${user.name}!`, 'success');
                
                document.getElementById('loginPage').style.display = 'none';
                
                if (selectedRole === 'admin') {
                    document.getElementById('adminDashboard').classList.add('active');
                    document.getElementById('adminUserName').textContent = user.name;
                    document.getElementById('adminAvatar').textContent = user.name.charAt(0).toUpperCase();
                    loadAdminDashboard();
                } else {
                    document.getElementById('employeeDashboard').classList.add('active');
                    document.getElementById('empUserName').textContent = user.name;
                    document.getElementById('empAvatar').textContent = user.name.charAt(0).toUpperCase();
                    loadEmployeeDashboard();
                }
            } else {
                showToast('Invalid credentials or role', 'error');
            }
        }

        function handleLogout() {
            currentUser = null;
            cart = { admin: [], emp: [] };
            
            document.getElementById('adminDashboard').classList.remove('active');
            document.getElementById('employeeDashboard').classList.remove('active');
            document.getElementById('loginPage').style.display = 'flex';
            
            document.getElementById('username').value = '';
            document.getElementById('password').value = '';
            
            showToast('Logged out successfully', 'info');
        }

        // ==================== DASHBOARD LOADING ====================
        function loadAdminDashboard() {
            updateStats();
            loadProducts('admin');
            loadRecentSales();
            loadAllSales();
            loadProductsTable();
            loadEmployeesTable();
            loadSettingsForm();
        }

        function loadEmployeeDashboard() {
            loadProducts('emp');
        }

        function updateStats() {
            const products = getProducts();
            const sales = getSales();
            const employees = getEmployees();
            
            const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
            
            document.getElementById('totalSales').textContent = '₹' + totalSales.toFixed(2);
            document.getElementById('totalBills').textContent = sales.length;
            document.getElementById('totalProducts').textContent = products.length;
            document.getElementById('totalEmployees').textContent = employees.length;
        }

        // ==================== TAB NAVIGATION ====================
        function switchTab(tabId) {
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.classList.toggle('active', tab.dataset.tab === tabId);
            });
            
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.toggle('active', content.id === tabId);
            });
        }

        // ==================== PRODUCTS ====================
        function loadProducts(context) {
            const products = getProducts();
            const categories = ['All', ...new Set(products.map(p => p.category))];
            
            // Load category filter
            const filterContainer = document.getElementById(`${context}CategoryFilter`);
            filterContainer.innerHTML = categories.map(cat => 
                `<button class="category-btn ${cat === 'All' ? 'active' : ''}" onclick="filterByCategory('${cat}', '${context}')">${cat}</button>`
            ).join('');
            
            renderProducts(products, context);
        }

        function renderProducts(products, context) {
            const grid = document.getElementById(`${context}ProductsGrid`);
            
            if (products.length === 0) {
                grid.innerHTML = '<div class="cart-empty"><i class="fas fa-box-open"></i><p>No products found</p></div>';
                return;
            }
            
            grid.innerHTML = products.map(product => `
                <div class="product-card glass" onclick="addToCart(${product.id}, '${context}')">
                    <div class="product-icon">${product.icon}</div>
                    <div class="product-name">${product.name}</div>
                    <div class="product-price">₹${product.price}</div>
                    <div class="product-stock ${product.stock < 10 ? 'low' : ''}">Stock: ${product.stock}</div>
                </div>
            `).join('');
        }

        function filterProducts(context) {
            const searchTerm = document.getElementById(`${context}SearchInput`).value.toLowerCase();
            const products = getProducts().filter(p => 
                p.name.toLowerCase().includes(searchTerm)
            );
            renderProducts(products, context);
        }

        function filterByCategory(category, context) {
            const products = getProducts().filter(p => 
                category === 'All' || p.category === category
            );
            
            document.querySelectorAll(`#${context}CategoryFilter .category-btn`).forEach(btn => {
                btn.classList.toggle('active', btn.textContent === category);
            });
            
            renderProducts(products, context);
        }

        // ==================== CART ====================
        function addToCart(productId, context) {
            const products = getProducts();
            const product = products.find(p => p.id === productId);
            
            if (!product || product.stock <= 0) {
                showToast('Product out of stock!', 'error');
                return;
            }
            
            const existingItem = cart[context].find(item => item.id === productId);
            
            if (existingItem) {
                if (existingItem.quantity >= product.stock) {
                    showToast('Not enough stock!', 'error');
                    return;
                }
                existingItem.quantity++;
            } else {
                cart[context].push({
                    id: product.id,
                    name: product.name,
                    price: product.price,
                    gst: product.gst,
                    icon: product.icon,
                    quantity: 1
                });
            }
            
            showToast(`Added ${product.name}`, 'success');
            renderCart(context);
        }

        function removeFromCart(productId, context) {
            cart[context] = cart[context].filter(item => item.id !== productId);
            showToast('Item removed', 'info');
            renderCart(context);
        }

        function updateQuantity(productId, delta, context) {
            const products = getProducts();
            const product = products.find(p => p.id === productId);
            const item = cart[context].find(i => i.id === productId);
            
            if (!item) return;
            
            const newQty = item.quantity + delta;
            
            if (newQty <= 0) {
                removeFromCart(productId, context);
                return;
            }
            
            if (newQty > product.stock) {
                showToast('Not enough stock!', 'error');
                return;
            }
            
            item.quantity = newQty;
            renderCart(context);
        }

        function clearCart(context) {
            cart[context] = [];
            document.getElementById(`${context}DiscountValue`).value = 0;
            showToast('Cart cleared', 'info');
            renderCart(context);
        }

        function renderCart(context) {
            const cartContainer = document.getElementById(`${context}CartItems`);
            const items = cart[context];
            
            if (items.length === 0) {
                cartContainer.innerHTML = `
                    <div class="cart-empty">
                        <i class="fas fa-shopping-basket"></i>
                        <p>Cart is empty</p>
                        <p>Add products to start billing</p>
                    </div>
                `;
                updateCartSummary(context);
                return;
            }
            
            cartContainer.innerHTML = items.map(item => `
                <div class="cart-item">
                    <div class="cart-item-icon">${item.icon}</div>
                    <div class="cart-item-details">
                        <div class="cart-item-name">${item.name}</div>
                        <div class="cart-item-price">₹${item.price} × ${item.quantity}</div>
                    </div>
                    <div class="quantity-control">
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, -1, '${context}')">−</button>
                        <span class="qty-value">${item.quantity}</span>
                        <button class="qty-btn" onclick="updateQuantity(${item.id}, 1, '${context}')">+</button>
                    </div>
                    <button class="remove-item" onclick="removeFromCart(${item.id}, '${context}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `).join('');
            
            updateCartSummary(context);
        }

        function updateCartSummary(context) {
            const items = cart[context];
            
            let subtotal = 0;
            let totalGst = 0;
            
            items.forEach(item => {
                const itemTotal = item.price * item.quantity;
                const itemGst = itemTotal * (item.gst / 100);
                subtotal += itemTotal;
                totalGst += itemGst;
            });
            
            const discountValue = parseFloat(document.getElementById(`${context}DiscountValue`).value) || 0;
            const discountType = document.getElementById(`${context}DiscountType`).value;
            
            let discount = 0;
            if (discountType === 'percent') {
                discount = (subtotal + totalGst) * (discountValue / 100);
            } else {
                discount = discountValue;
            }
            
            const grandTotal = subtotal + totalGst - discount;
            
            document.getElementById(`${context}Subtotal`).textContent = '₹' + subtotal.toFixed(2);
            document.getElementById(`${context}Gst`).textContent = '₹' + totalGst.toFixed(2);
            document.getElementById(`${context}Discount`).textContent = '-₹' + discount.toFixed(2);
            document.getElementById(`${context}Total`).textContent = '₹' + grandTotal.toFixed(2);
            
            document.getElementById(`${context}CheckoutBtn`).disabled = items.length === 0;
        }

        // Add discount change listeners
        setTimeout(() => {
            document.getElementById('adminDiscountValue').addEventListener('input', () => updateCartSummary('admin'));
            document.getElementById('adminDiscountType').addEventListener('change', () => updateCartSummary('admin'));
            document.getElementById('empDiscountValue').addEventListener('input', () => updateCartSummary('emp'));
            document.getElementById('empDiscountType').addEventListener('change', () => updateCartSummary('emp'));
        }, 100);

        // ==================== PAYMENT ====================
        function generatePayment(context) {
            if (cart[context].length === 0) {
                showToast('Cart is empty!', 'error');
                return;
            }
            
            currentPaymentContext = context;
            const settings = getSettings();
            
            let subtotal = 0;
            let totalGst = 0;
            
            cart[context].forEach(item => {
                const itemTotal = item.price * item.quantity;
                const itemGst = itemTotal * (item.gst / 100);
                subtotal += itemTotal;
                totalGst += itemGst;
            });
            
            const discountValue = parseFloat(document.getElementById(`${context}DiscountValue`).value) || 0;
            const discountType = document.getElementById(`${context}DiscountType`).value;
            
            let discount = 0;
            if (discountType === 'percent') {
                discount = (subtotal + totalGst) * (discountValue / 100);
            } else {
                discount = discountValue;
            }
            
            const grandTotal = subtotal + totalGst - discount;
            
            currentBillData = {
                billNumber: getNextBillNumber(),
                date: new Date().toISOString(),
                cashier: currentUser.name,
                items: [...cart[context]],
                subtotal,
                gst: totalGst,
                discount,
                discountValue,
                discountType,
                total: grandTotal,
                status: 'PAID'
            };
            
            document.getElementById('paymentAmount').textContent = '₹' + grandTotal.toFixed(2);
            document.getElementById('paymentUpiId').textContent = 'UPI ID: ' + (config.upi_id || settings.upiId);
            
            // Generate QR Code
           const upiId = "8903559673@ybl";
const shopName = "Smart Billing System";

const upiLink = `upi://pay?pa=${upiId}&pn=${encodeURIComponent(shopName)}&am=${grandTotal.toFixed(2)}&cu=INR`;

const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;

document.getElementById('qrCode').innerHTML = `
  <img src="${qrUrl}" alt="Payment QR" loading="lazy">
`;

document.getElementById('paymentUpiId').innerHTML =
  `UPI ID: <strong>${upiId}</strong>`;

document.getElementById('paymentModal').classList.add('active');

        }

        function confirmPayment() {
            if (!currentBillData || !currentPaymentContext) return;
            
            // Update stock
            const products = getProducts();
            currentBillData.items.forEach(cartItem => {
                const product = products.find(p => p.id === cartItem.id);
                if (product) {
                    product.stock -= cartItem.quantity;
                }
            });
            saveProducts(products);
            
            // Save sale
            const sales = getSales();
            sales.unshift(currentBillData);
            saveSales(sales);
            
            // Clear cart
            cart[currentPaymentContext] = [];
            document.getElementById(`${currentPaymentContext}DiscountValue`).value = 0;
            renderCart(currentPaymentContext);
            
            // Refresh products
            loadProducts(currentPaymentContext);
            
            closeModal('paymentModal');
            
            // Show invoice
            generateInvoice(currentBillData);
            
            // Update admin stats if admin
            if (currentPaymentContext === 'admin') {
                updateStats();
                loadRecentSales();
                loadAllSales();
            }
            
            showToast('Payment confirmed! Bill saved.', 'success');
        }

        function generateInvoice(billData) {
            const settings = getSettings();
            const shopName = config.shop_name || settings.shopName;
            
            const invoiceHtml = `
                <div class="invoice-header">
                    <div class="invoice-shop-name">${shopName}</div>
                    <div>Tax Invoice</div>
                </div>
                <div class="invoice-details">
                    <div class="invoice-row">
                        <span>Bill No:</span>
                        <span>${billData.billNumber}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Date:</span>
                        <span>${new Date(billData.date).toLocaleDateString()}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Time:</span>
                        <span>${new Date(billData.date).toLocaleTimeString()}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Cashier:</span>
                        <span>${billData.cashier}</span>
                    </div>
                </div>
                <div class="invoice-items">
                    <div class="invoice-item" style="font-weight: 600;">
                        <span class="invoice-item-name">Item</span>
                        <span class="invoice-item-qty">Qty</span>
                        <span class="invoice-item-price">Amount</span>
                    </div>
                    ${billData.items.map(item => `
                        <div class="invoice-item">
                            <span class="invoice-item-name">${item.name}</span>
                            <span class="invoice-item-qty">${item.quantity}</span>
                            <span class="invoice-item-price">₹${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="invoice-details">
                    <div class="invoice-row">
                        <span>Subtotal:</span>
                        <span>₹${billData.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="invoice-row">
                        <span>GST:</span>
                        <span>₹${billData.gst.toFixed(2)}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Discount:</span>
                        <span>-₹${billData.discount.toFixed(2)}</span>
                    </div>
                </div>
                <div class="invoice-total">
                    <div class="invoice-row">
                        <span>GRAND TOTAL:</span>
                        <span>₹${billData.total.toFixed(2)}</span>
                    </div>
                </div>
                <div class="invoice-footer">
                    Thank you for shopping with us!<br>
                    Visit again!
                </div>
            `;
            
            document.getElementById('invoiceContent').innerHTML = invoiceHtml;
            document.getElementById('invoiceModal').classList.add('active');
        }

        function printInvoice() {
            const content = document.getElementById('invoiceContent').innerHTML;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Invoice</title>
                    <style>
                        body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 20px; }
                        .invoice-header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
                        .invoice-shop-name { font-size: 1.3rem; font-weight: bold; }
                        .invoice-row { display: flex; justify-content: space-between; padding: 3px 0; }
                        .invoice-items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0; }
                        .invoice-item { display: flex; justify-content: space-between; padding: 5px 0; }
                        .invoice-item-name { flex: 2; }
                        .invoice-item-qty { flex: 1; text-align: center; }
                        .invoice-item-price { flex: 1; text-align: right; }
                        .invoice-total { font-weight: bold; font-size: 1.1rem; }
                        .invoice-footer { text-align: center; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #000; }
                    </style>
                </head>
                <body>${content}</body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }

        function downloadInvoice() {
            const content = document.getElementById('invoiceContent').innerText;
            const blob = new Blob([content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice_${currentBillData.billNumber}.txt`;
            a.click();
            URL.revokeObjectURL(url);
            showToast('Invoice downloaded!', 'success');
        }

        // ==================== VOICE RECOGNITION ====================
        let recognition = null;
        let isListening = false;

        function initVoiceRecognition() {
            if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                recognition = new SpeechRecognition();
                recognition.continuous = false;
                recognition.interimResults = true;
                recognition.lang = 'en-IN';
            }
        }

        function startVoiceRecognition(context) {
            if (!recognition) {
                showToast('Voice recognition not supported', 'error');
                return;
            }
            
            const voiceBtn = document.getElementById(`${context}VoiceBtn`);
            const voiceDisplay = document.getElementById(`${context}VoiceDisplay`);
            const voiceText = document.getElementById(`${context}VoiceText`);
            const voiceStatus = document.getElementById(`${context}VoiceStatus`);
            
            if (isListening) {
                recognition.stop();
                return;
            }
            
            isListening = true;
            voiceBtn.classList.add('listening');
            voiceDisplay.classList.add('active');
            voiceStatus.textContent = 'Listening...';
            voiceText.textContent = '';
            
            recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                
                voiceText.textContent = `"${transcript}"`;
                
                if (event.results[0].isFinal) {
                    processVoiceCommand(transcript.toLowerCase(), context);
                }
            };
            
            recognition.onerror = (event) => {
                showToast('Voice recognition error', 'error');
                stopVoiceRecognition(context);
            };
            
            recognition.onend = () => {
                stopVoiceRecognition(context);
            };
            
            recognition.start();
        }

        function stopVoiceRecognition(context) {
            isListening = false;
            const voiceBtn = document.getElementById(`${context}VoiceBtn`);
            const voiceDisplay = document.getElementById(`${context}VoiceDisplay`);
            
            voiceBtn.classList.remove('listening');
            
            setTimeout(() => {
                voiceDisplay.classList.remove('active');
            }, 2000);
        }

        function processVoiceCommand(command, context) {
            const products = getProducts();
            const voiceStatus = document.getElementById(`${context}VoiceStatus`);
            
            // Add product command
            const addMatch = command.match(/add\s+(\d+)?\s*(.+)/i);
            if (addMatch) {
                const quantity = parseInt(addMatch[1]) || 1;
                const productName = addMatch[2].trim();
                
                const product = products.find(p => 
                    p.name.toLowerCase().includes(productName)
                );
                
                if (product) {
                    for (let i = 0; i < quantity; i++) {
                        addToCart(product.id, context);
                    }
                    voiceStatus.textContent = `Added ${quantity} ${product.name}`;
                    return;
                } else {
                    voiceStatus.textContent = `Product "${productName}" not found`;
                    showToast(`Product "${productName}" not found`, 'error');
                    return;
                }
            }
            
            // Remove product command
            const removeMatch = command.match(/remove\s+(\d+)?\s*(.+)/i);
            if (removeMatch) {
                const quantity = parseInt(removeMatch[1]) || 1;
                const productName = removeMatch[2].trim();
                
                const cartItem = cart[context].find(item => 
                    item.name.toLowerCase().includes(productName)
                );
                
                if (cartItem) {
                    for (let i = 0; i < quantity; i++) {
                        updateQuantity(cartItem.id, -1, context);
                    }
                    voiceStatus.textContent = `Removed ${quantity} ${cartItem.name}`;
                    return;
                } else {
                    voiceStatus.textContent = `"${productName}" not in cart`;
                    return;
                }
            }
            
            // Apply discount command
            const discountMatch = command.match(/apply\s+(\d+)\s*(percent|rupee|rs)?/i);
            if (discountMatch) {
                const value = parseInt(discountMatch[1]);
                const type = discountMatch[2];
                
                document.getElementById(`${context}DiscountValue`).value = value;
                if (type && (type.includes('rupee') || type.includes('rs'))) {
                    document.getElementById(`${context}DiscountType`).value = 'amount';
                } else {
                    document.getElementById(`${context}DiscountType`).value = 'percent';
                }
                updateCartSummary(context);
                voiceStatus.textContent = `Applied ${value}${type ? (type.includes('rupee') || type.includes('rs') ? '₹' : '%') : '%'} discount`;
                return;
            }
            
            // Generate payment command
            if (command.includes('generate payment') || command.includes('checkout') || command.includes('pay')) {
                generatePayment(context);
                voiceStatus.textContent = 'Generating payment QR...';
                return;
            }
            
            // Clear cart command
            if (command.includes('clear') || command.includes('empty cart')) {
                clearCart(context);
                voiceStatus.textContent = 'Cart cleared';
                return;
            }
            
            voiceStatus.textContent = 'Command not recognized';
            showToast('Command not recognized', 'info');
        }

        // ==================== ADMIN FUNCTIONS ====================
        function loadRecentSales() {
            const sales = getSales().slice(0, 5);
            const tbody = document.querySelector('#recentSalesTable tbody');
            
            if (sales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.7;">No sales yet</td></tr>';
                return;
            }
            
            tbody.innerHTML = sales.map(sale => `
                <tr>
                    <td>${sale.billNumber}</td>
                    <td>${new Date(sale.date).toLocaleDateString()}</td>
                    <td>${sale.items.length} items</td>
                    <td>₹${sale.total.toFixed(2)}</td>
                    <td><span style="color: #43e97b;">● ${sale.status}</span></td>
                </tr>
            `).join('');
        }

        function loadAllSales() {
            const sales = getSales();
            const tbody = document.querySelector('#allSalesTable tbody');
            
            if (sales.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; opacity: 0.7;">No sales yet</td></tr>';
                return;
            }
            
            tbody.innerHTML = sales.map(sale => `
                <tr>
                    <td>${sale.billNumber}</td>
                    <td>${new Date(sale.date).toLocaleDateString()}</td>
                    <td>${sale.cashier}</td>
                    <td>${sale.items.length}</td>
                    <td>₹${sale.subtotal.toFixed(2)}</td>
                    <td>₹${sale.gst.toFixed(2)}</td>
                    <td>₹${sale.discount.toFixed(2)}</td>
                    <td>₹${sale.total.toFixed(2)}</td>
                    <td>
                        <button class="action-btn edit" onclick="viewSaleInvoice('${sale.billNumber}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        function viewSaleInvoice(billNumber) {
            const sales = getSales();
            const sale = sales.find(s => s.billNumber === billNumber);
            
            if (!sale) return;
            
            const settings = getSettings();
            const shopName = config.shop_name || settings.shopName;
            
            const invoiceHtml = `
                <div class="invoice-header">
                    <div class="invoice-shop-name">${shopName}</div>
                    <div>Tax Invoice</div>
                </div>
                <div class="invoice-details">
                    <div class="invoice-row">
                        <span>Bill No:</span>
                        <span>${sale.billNumber}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Date:</span>
                        <span>${new Date(sale.date).toLocaleDateString()}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Time:</span>
                        <span>${new Date(sale.date).toLocaleTimeString()}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Cashier:</span>
                        <span>${sale.cashier}</span>
                    </div>
                </div>
                <div class="invoice-items">
                    <div class="invoice-item" style="font-weight: 600;">
                        <span class="invoice-item-name">Item</span>
                        <span class="invoice-item-qty">Qty</span>
                        <span class="invoice-item-price">Amount</span>
                    </div>
                    ${sale.items.map(item => `
                        <div class="invoice-item">
                            <span class="invoice-item-name">${item.name}</span>
                            <span class="invoice-item-qty">${item.quantity}</span>
                            <span class="invoice-item-price">₹${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="invoice-details">
                    <div class="invoice-row">
                        <span>Subtotal:</span>
                        <span>₹${sale.subtotal.toFixed(2)}</span>
                    </div>
                    <div class="invoice-row">
                        <span>GST:</span>
                        <span>₹${sale.gst.toFixed(2)}</span>
                    </div>
                    <div class="invoice-row">
                        <span>Discount:</span>
                        <span>-₹${sale.discount.toFixed(2)}</span>
                    </div>
                </div>
                <div class="invoice-total">
                    <div class="invoice-row">
                        <span>GRAND TOTAL:</span>
                        <span>₹${sale.total.toFixed(2)}</span>
                    </div>
                </div>
                <div class="invoice-footer">
                    Thank you for shopping with us!<br>
                    Visit again!
                </div>
            `;
            
            document.getElementById('viewInvoiceContent').innerHTML = invoiceHtml;
            document.getElementById('viewInvoiceModal').classList.add('active');
        }

        function printViewInvoice() {
            const content = document.getElementById('viewInvoiceContent').innerHTML;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head>
                    <title>Invoice</title>
                    <style>
                        body { font-family: 'Courier New', monospace; max-width: 300px; margin: 0 auto; padding: 20px; }
                        .invoice-header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 15px; margin-bottom: 15px; }
                        .invoice-shop-name { font-size: 1.3rem; font-weight: bold; }
                        .invoice-row { display: flex; justify-content: space-between; padding: 3px 0; }
                        .invoice-items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0; }
                        .invoice-item { display: flex; justify-content: space-between; padding: 5px 0; }
                        .invoice-item-name { flex: 2; }
                        .invoice-item-qty { flex: 1; text-align: center; }
                        .invoice-item-price { flex: 1; text-align: right; }
                        .invoice-total { font-weight: bold; font-size: 1.1rem; }
                        .invoice-footer { text-align: center; margin-top: 15px; padding-top: 15px; border-top: 2px dashed #000; }
                    </style>
                </head>
                <body>${content}</body>
                </html>
            `);
            printWindow.document.close();
            printWindow.print();
        }

        function loadProductsTable() {
            const products = getProducts();
            const tbody = document.querySelector('#productsTable tbody');
            
            tbody.innerHTML = products.map(product => `
                <tr>
                    <td>${product.icon}</td>
                    <td>${product.name}</td>
                    <td>₹${product.price}</td>
                    <td>${product.gst}%</td>
                    <td>${product.category}</td>
                    <td class="${product.stock < 10 ? 'low' : ''}">${product.stock}</td>
                    <td>
                        <button class="action-btn edit" onclick="editProduct(${product.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="showDeleteConfirm(${product.id}, 'product', this)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        function handleProductSubmit(event) {
            event.preventDefault();
            
            const products = getProducts();
            const editId = document.getElementById('editProductId').value;
            
            const productData = {
                name: document.getElementById('productName').value,
                price: parseFloat(document.getElementById('productPrice').value),
                gst: parseFloat(document.getElementById('productGst').value),
                category: document.getElementById('productCategory').value,
                stock: parseInt(document.getElementById('productStock').value),
                icon: document.getElementById('productIcon').value
            };
            
            if (editId) {
                const index = products.findIndex(p => p.id === parseInt(editId));
                if (index !== -1) {
                    products[index] = { ...products[index], ...productData };
                    showToast('Product updated!', 'success');
                }
            } else {
                productData.id = Date.now();
                products.push(productData);
                showToast('Product added!', 'success');
            }
            
            saveProducts(products);
            loadProductsTable();
            loadProducts('admin');
            updateStats();
            
            document.getElementById('productForm').reset();
            document.getElementById('editProductId').value = '';
            document.getElementById('productIcon').value = '📦';
        }

        function editProduct(id) {
            const products = getProducts();
            const product = products.find(p => p.id === id);
            
            if (product) {
                document.getElementById('productName').value = product.name;
                document.getElementById('productPrice').value = product.price;
                document.getElementById('productGst').value = product.gst;
                document.getElementById('productCategory').value = product.category;
                document.getElementById('productStock').value = product.stock;
                document.getElementById('productIcon').value = product.icon;
                document.getElementById('editProductId').value = id;
                
                showToast('Editing product...', 'info');
            }
        }

        function deleteProduct(id) {
            let products = getProducts();
            products = products.filter(p => p.id !== id);
            saveProducts(products);
            
            loadProductsTable();
            loadProducts('admin');
            updateStats();
            
            showToast('Product deleted!', 'success');
        }

        function loadEmployeesTable() {
            const employees = getEmployees();
            const tbody = document.querySelector('#employeesTable tbody');
            
            tbody.innerHTML = employees.map(emp => `
                <tr>
                    <td>${emp.id}</td>
                    <td>${emp.name}</td>
                    <td>${emp.username}</td>
                    <td>
                        <button class="action-btn edit" onclick="editEmployee(${emp.id})">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="action-btn delete" onclick="showDeleteConfirm(${emp.id}, 'employee', this)">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        function handleEmployeeSubmit(event) {
            event.preventDefault();
            
            const employees = getEmployees();
            const users = getUsers();
            const editId = document.getElementById('editEmpId').value;
            
            const empData = {
                name: document.getElementById('empName').value,
                username: document.getElementById('empUsername').value,
                password: document.getElementById('empPassword').value
            };
            
            if (editId) {
                const index = employees.findIndex(e => e.id === parseInt(editId));
                if (index !== -1) {
                    const oldUsername = employees[index].username;
                    delete users[oldUsername];
                    
                    employees[index] = { ...employees[index], ...empData };
                    users[empData.username] = {
                        username: empData.username,
                        password: empData.password,
                        role: 'employee',
                        name: empData.name
                    };
                    
                    showToast('Employee updated!', 'success');
                }
            } else {
                empData.id = Date.now();
                employees.push(empData);
                
                users[empData.username] = {
                    username: empData.username,
                    password: empData.password,
                    role: 'employee',
                    name: empData.name
                };
                
                showToast('Employee added!', 'success');
            }
            
            saveEmployees(employees);
            saveUsers(users);
            loadEmployeesTable();
            updateStats();
            
            document.getElementById('employeeForm').reset();
            document.getElementById('editEmpId').value = '';
        }

        function editEmployee(id) {
            const employees = getEmployees();
            const emp = employees.find(e => e.id === id);
            
            if (emp) {
                document.getElementById('empName').value = emp.name;
                document.getElementById('empUsername').value = emp.username;
                document.getElementById('empPassword').value = emp.password;
                document.getElementById('editEmpId').value = id;
                
                showToast('Editing employee...', 'info');
            }
        }

        function deleteEmployee(id) {
            let employees = getEmployees();
            const users = getUsers();
            
            const emp = employees.find(e => e.id === id);
            if (emp) {
                delete users[emp.username];
            }
            
            employees = employees.filter(e => e.id !== id);
            
            saveEmployees(employees);
            saveUsers(users);
            loadEmployeesTable();
            updateStats();
            
            showToast('Employee deleted!', 'success');
        }

        // Inline delete confirmation
        function showDeleteConfirm(id, type, button) {
            const originalHtml = button.innerHTML;
            const parent = button.parentElement;
            
            // Replace with confirmation buttons
            const confirmDiv = document.createElement('div');
            confirmDiv.className = 'confirm-delete';
            confirmDiv.innerHTML = `
                <span>Delete?</span>
                <button class="confirm-yes" onclick="confirmDelete(${id}, '${type}', this)">Yes</button>
                <button class="confirm-no" onclick="cancelDelete(this, '${originalHtml}')">No</button>
            `;
            
            button.style.display = 'none';
            parent.appendChild(confirmDiv);
        }

        function confirmDelete(id, type, button) {
            if (type === 'product') {
                deleteProduct(id);
            } else if (type === 'employee') {
                deleteEmployee(id);
            }
        }

        function cancelDelete(button, originalHtml) {
            const confirmDiv = button.parentElement;
            const parent = confirmDiv.parentElement;
            const deleteBtn = parent.querySelector('.action-btn.delete');
            
            deleteBtn.style.display = '';
            confirmDiv.remove();
        }

        function loadSettingsForm() {
            const settings = getSettings();
            document.getElementById('settingsShopName').value = config.shop_name || settings.shopName;
            document.getElementById('settingsUpiId').value = config.upi_id || settings.upiId;
        }

        function saveSettings(event) {
            event.preventDefault();
            
            const newShopName = document.getElementById('settingsShopName').value;
            const newUpiId = document.getElementById('settingsUpiId').value;
            
            config.shop_name = newShopName;
            config.upi_id = newUpiId;
            
            saveSettingsToStorage({ shopName: newShopName, upiId: newUpiId });
            
            if (window.elementSdk) {
                window.elementSdk.setConfig({ shop_name: newShopName, upi_id: newUpiId });
            }
            
            updateShopDisplay();
            showToast('Settings saved!', 'success');
        }

        // ==================== MODAL FUNCTIONS ====================
        function closeModal(modalId) {
            document.getElementById(modalId).classList.remove('active');
        }

        // Close modal on backdrop click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });

        // ==================== FULLSCREEN ====================
        function toggleFullscreen() {
            if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
                document.body.classList.add('fullscreen');
            } else {
                document.exitFullscreen();
                document.body.classList.remove('fullscreen');
            }
        }

        // ==================== KEYBOARD SHORTCUTS ====================
        document.addEventListener('keydown', (e) => {
            // Ctrl + M for voice
            if (e.ctrlKey && e.key === 'm') {
                e.preventDefault();
                const context = currentUser?.role === 'admin' ? 'admin' : 'emp';
                startVoiceRecognition(context);
            }
            
            // Ctrl + P for payment
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                const context = currentUser?.role === 'admin' ? 'admin' : 'emp';
                generatePayment(context);
            }
            
            // Escape to close modals
            if (e.key === 'Escape') {
                document.querySelectorAll('.modal-overlay.active').forEach(modal => {
                    modal.classList.remove('active');
                });
            }
        });

        // ==================== INITIALIZATION ====================
        function init() {
            initializeData();
            initVoiceRecognition();
            
            // Load settings
            const settings = getSettings();
            config.shop_name = settings.shopName || defaultConfig.shop_name;
            config.upi_id = settings.upiId || defaultConfig.upi_id;
            
            updateShopDisplay();
        }

        // Initialize on load
        init();
    </script>
 <script>(function(){function c(){var b=a.contentDocument||a.contentWindow.document;if(b){var d=b.createElement('script');d.innerHTML="window.__CF$cv$params={r:'9beec561f31bb2bb',t:'MTc2ODU3ODY1Mi4wMDAwMDA='};var a=document.createElement('script');a.nonce='';a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';document.getElementsByTagName('head')[0].appendChild(a);";b.getElementsByTagName('head')[0].appendChild(d)}}if(document.body){var a=document.createElement('iframe');a.height=1;a.width=1;a.style.position='absolute';a.style.top=0;a.style.left=0;a.style.border='none';a.style.visibility='hidden';document.body.appendChild(a);if('loading'!==document.readyState)c();else if(window.addEventListener)document.addEventListener('DOMContentLoaded',c);else{var e=document.onreadystatechange||function(){};document.onreadystatechange=function(b){e(b);'loading'!==document.readyState&&(document.onreadystatechange=e,c())}}}})();</script></body>
