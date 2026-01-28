/**
 * Manage Products UI Controller
 * Handles the product management interface
 */
import { ProductManager } from './components/ProductManager.js';
import { CommodityService } from './services/CommodityService.js';

let productManager = null;
let commodityService = null;
let currentShipmentId = null;
let currentShipmentRef = null;

/**
 * Initialize the product management system
 */
export async function initProductManagement(supabase, shipmentId, shipmentRef) {
  try {
    // Initialize services
    commodityService = new CommodityService(supabase);
    productManager = new ProductManager(supabase, commodityService);
    
    // Store shipment info
    currentShipmentId = shipmentId;
    currentShipmentRef = shipmentRef;
    
    // Initialize product manager
    await productManager.initialize(shipmentId);
    
    // Setup event listeners
    setupEventListeners();
    
    // Populate commodity dropdown
    await populateCommodityDropdown();
    
    return true;
  } catch (error) {
    console.error('Error initializing product management:', error);
    return false;
  }
}

/**
 * Open the manage products modal
 */
window.openManageProductsModal = async function() {
  const modal = document.getElementById('manage-products-modal');
  const shipmentRefBadge = document.getElementById('manage-products-shipment-ref');
  
  if (!modal) {
    console.error('Manage products modal not found');
    return;
  }
  
  // Set shipment reference
  if (shipmentRefBadge && currentShipmentRef) {
    shipmentRefBadge.textContent = currentShipmentRef;
  }
  
  // Show modal
  modal.style.display = 'flex';
  
  // Initialize Select2 for dropdowns (do this after modal is visible)
  setTimeout(() => {
    initializeSelect2Dropdowns();
  }, 100);
  
  // Load current products
  await loadCurrentProducts();
  
  // Switch to current products tab
  switchToTab('current-products');
};

/**
 * Close the manage products modal
 */
window.closeManageProductsModal = function() {
  const modal = document.getElementById('manage-products-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tab = e.target.closest('.tab-btn').dataset.tab;
      switchToTab(tab);
    });
  });
  
  // Add product form
  const addForm = document.getElementById('add-product-form');
  if (addForm) {
    addForm.addEventListener('submit', handleAddProduct);
  }
  
  // Edit product form
  const editForm = document.getElementById('edit-product-form');
  if (editForm) {
    editForm.addEventListener('submit', handleEditProduct);
  }
  
  // Quantity/Rate change - calculate amount
  const quantityInput = document.getElementById('add-quantity');
  const rateInput = document.getElementById('add-rate');
  if (quantityInput && rateInput) {
    quantityInput.addEventListener('input', calculateAmount);
    rateInput.addEventListener('input', calculateAmount);
  }
  
  // Edit modal quantity/rate change
  const editQuantity = document.getElementById('edit-quantity');
  const editRate = document.getElementById('edit-rate');
  if (editQuantity && editRate) {
    editQuantity.addEventListener('input', calculateEditAmount);
    editRate.addEventListener('input', calculateEditAmount);
  }
}

/**
 * Switch between tabs
 */
window.switchToTab = function(tabName) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.tab === tabName) {
      btn.classList.add('active');
    }
  });
  
  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  
  const activeTab = document.getElementById(`tab-${tabName}`);
  if (activeTab) {
    activeTab.classList.add('active');
    
    // Load content based on tab
    if (tabName === 'current-products') {
      loadCurrentProducts();
    } else if (tabName === 'change-history') {
      loadChangeHistory();
    }
  }
};

/**
 * Populate commodity dropdown
 */
async function populateCommodityDropdown() {
  const select = document.getElementById('add-commodity');
  if (!select) return;
  
  const commodities = productManager.getCommodities();
  
  // Clear existing options (except first)
  select.innerHTML = '<option value="">Select Commodity</option>';
  
  commodities.forEach(commodity => {
    const option = document.createElement('option');
    option.value = commodity.id;
    option.textContent = commodity.name;
    select.appendChild(option);
  });
}

/**
 * Initialize Select2 on dropdowns
 */
function initializeSelect2Dropdowns() {
  console.log('Initializing Select2 dropdowns...');
  
  // Check if jQuery and Select2 are available
  if (typeof jQuery === 'undefined' || !jQuery.fn.select2) {
    console.error('jQuery or Select2 not loaded');
    return;
  }
  
  // Destroy existing Select2 instances if any
  if (jQuery('#add-commodity').hasClass('select2-hidden-accessible')) {
    jQuery('#add-commodity').select2('destroy');
  }
  if (jQuery('#add-variety').hasClass('select2-hidden-accessible')) {
    jQuery('#add-variety').select2('destroy');
  }
  
  // Initialize Select2 for commodity dropdown
  jQuery('#add-commodity').select2({
    placeholder: 'Search for a commodity...',
    allowClear: true,
    width: '100%',
    dropdownParent: jQuery('#manage-products-modal')
  });
  
  // Initialize Select2 for variety dropdown (initially disabled)
  jQuery('#add-variety').select2({
    placeholder: 'Select commodity first...',
    allowClear: true,
    width: '100%',
    dropdownParent: jQuery('#manage-products-modal')
  });
  
  // Attach Select2 change events
  jQuery('#add-commodity').on('select2:select select2:clear', function(e) {
    const commodityId = jQuery(this).val();
    handleCommodityChange({ target: { value: commodityId || '' } });
  });
  
  jQuery('#add-variety').on('select2:select select2:clear', function(e) {
    const varietyId = jQuery(this).val();
    handleVarietyChange({ target: { value: varietyId || '' } });
  });
  
  console.log('Select2 initialized successfully');
}

/**
 * Handle commodity change
 */
function handleCommodityChange(e) {
  const commodityId = e.target.value;
  const varietySelect = document.getElementById('add-variety');
  const unitSelect = document.getElementById('add-unit');
  
  if (!commodityId) {
    varietySelect.disabled = true;
    varietySelect.innerHTML = '<option value="">Select Commodity First</option>';
    unitSelect.disabled = true;
    unitSelect.innerHTML = '<option value="">Select Product First</option>';
    
    // Reinitialize Select2 for variety
    if (typeof jQuery !== 'undefined' && jQuery.fn.select2) {
      jQuery('#add-variety').select2('destroy');
      jQuery('#add-variety').select2({
        placeholder: 'Select commodity first...',
        allowClear: true,
        width: '100%',
        dropdownParent: jQuery('#manage-products-modal')
      });
    }
    return;
  }
  
  // Load varieties for this commodity
  const varieties = productManager.getVarietiesByCommodity(commodityId);
  
  varietySelect.disabled = false;
  varietySelect.innerHTML = '<option value="">Select Variety</option>';
  
  varieties.forEach(variety => {
    // Check if already in shipment
    const alreadyExists = productManager.hasProduct(variety.id);
    const option = document.createElement('option');
    option.value = variety.id;
    option.textContent = `${variety.product_name} - ${variety.variety_name}${alreadyExists ? ' (Already in shipment)' : ''}`;
    option.disabled = alreadyExists;
    varietySelect.appendChild(option);
  });
  
  // Reinitialize Select2 for variety with new options
  if (typeof jQuery !== 'undefined' && jQuery.fn.select2) {
    jQuery('#add-variety').select2('destroy');
    jQuery('#add-variety').select2({
      placeholder: 'Search for a product variety...',
      allowClear: true,
      width: '100%',
      dropdownParent: jQuery('#manage-products-modal')
    });
    
    // Re-attach the change event
    jQuery('#add-variety').off('select2:select select2:clear').on('select2:select select2:clear', function(e) {
      const varietyId = jQuery(this).val();
      handleVarietyChange({ target: { value: varietyId || '' } });
    });
  }
}

/**
 * Handle variety change
 */
function handleVarietyChange(e) {
  const varietyId = e.target.value;
  const unitSelect = document.getElementById('add-unit');
  const rateInput = document.getElementById('add-rate');
  
  if (!varietyId) {
    unitSelect.disabled = true;
    unitSelect.innerHTML = '<option value="">Select Product First</option>';
    return;
  }
  
  // Find the selected variety
  const variety = productManager.productVarieties.find(v => v.id === varietyId);
  if (!variety) return;
  
  // Populate unit
  unitSelect.disabled = false;
  unitSelect.innerHTML = `<option value="${variety.unit}">${variety.unit}</option>`;
  
  // Set default rate if available
  if (variety.rate_per_unit) {
    rateInput.value = variety.rate_per_unit;
    calculateAmount();
  }
}

/**
 * Calculate amount from quantity and rate
 */
function calculateAmount() {
  const quantity = parseFloat(document.getElementById('add-quantity').value) || 0;
  const rate = parseFloat(document.getElementById('add-rate').value) || 0;
  const amountInput = document.getElementById('add-amount');
  
  if (quantity > 0 && rate > 0) {
    amountInput.value = (quantity * rate).toFixed(2);
  } else {
    amountInput.value = '';
  }
}

/**
 * Calculate amount in edit modal
 */
function calculateEditAmount() {
  const quantity = parseFloat(document.getElementById('edit-quantity').value) || 0;
  const rate = parseFloat(document.getElementById('edit-rate').value) || 0;
  const amountInput = document.getElementById('edit-amount');
  
  if (quantity > 0 && rate > 0) {
    amountInput.value = (quantity * rate).toFixed(2);
  } else {
    amountInput.value = '';
  }
}

/**
 * Handle add product form submission
 */
async function handleAddProduct(e) {
  e.preventDefault();
  
  const varietyId = document.getElementById('add-variety').value;
  const quantity = parseFloat(document.getElementById('add-quantity').value);
  const unit = document.getElementById('add-unit').value;
  const rate = parseFloat(document.getElementById('add-rate').value) || null;
  const amount = parseFloat(document.getElementById('add-amount').value) || null;
  const reason = document.getElementById('add-reason').value || null;
  
  if (!varietyId || !quantity || !unit) {
    alert('Please fill in all required fields');
    return;
  }
  
  // Show loading
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';
  
  try {
    const result = await productManager.addProduct(
      varietyId,
      quantity,
      unit,
      rate,
      amount,
      reason
    );
    
    if (result.success) {
      alert('Product added successfully!');
      resetAddProductForm();
      await loadCurrentProducts();
      switchToTab('current-products');
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error adding product:', error);
    alert('Failed to add product: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Reset add product form
 */
window.resetAddProductForm = function() {
  const form = document.getElementById('add-product-form');
  if (form) {
    form.reset();
    
    // Reset Select2 dropdowns
    if (typeof jQuery !== 'undefined' && jQuery.fn.select2) {
      jQuery('#add-commodity').val(null).trigger('change');
      jQuery('#add-variety').val(null).trigger('change');
    }
    
    document.getElementById('add-variety').disabled = true;
    document.getElementById('add-unit').disabled = true;
    
    // Reset variety dropdown
    const varietySelect = document.getElementById('add-variety');
    varietySelect.innerHTML = '<option value="">Select Commodity First</option>';
    
    const unitSelect = document.getElementById('add-unit');
    unitSelect.innerHTML = '<option value="">Select Product First</option>';
  }
};

/**
 * Load and display current products
 */
window.refreshProductsList = loadCurrentProducts;

async function loadCurrentProducts() {
  const loading = document.getElementById('current-products-loading');
  const empty = document.getElementById('current-products-empty');
  const tableContainer = document.getElementById('current-products-table-container');
  const tbody = document.getElementById('current-products-tbody');
  
  // Show loading
  loading.style.display = 'block';
  empty.style.display = 'none';
  tableContainer.style.display = 'none';
  
  try {
    const products = await productManager.loadShipmentProducts();
    
    loading.style.display = 'none';
    
    if (products.length === 0) {
      empty.style.display = 'block';
      return;
    }
    
    // Populate table
    tbody.innerHTML = '';
    const template = document.getElementById('product-row-template');
    
    products.forEach(product => {
      const row = template.content.cloneNode(true);
      const tr = row.querySelector('tr');
      
      tr.dataset.productVarietyId = product.product_variety_id;
      
      row.querySelector('.commodity-name').textContent = product.product_variety.commodity.name;
      row.querySelector('.product-name').textContent = product.product_variety.product_name;
      row.querySelector('.variety-name').textContent = product.product_variety.variety_name;
      row.querySelector('.quantity').textContent = product.quantity;
      row.querySelector('.unit').textContent = product.unit;
      row.querySelector('.rate').textContent = product.rate ? `$${product.rate}` : '-';
      row.querySelector('.amount').textContent = product.amount ? `$${product.amount}` : '-';
      
      // Add event listeners
      row.querySelector('.btn-edit').addEventListener('click', () => {
        openEditProductModal(product);
      });
      
      row.querySelector('.btn-delete').addEventListener('click', () => {
        openRemoveProductModal(product);
      });
      
      tbody.appendChild(row);
    });
    
    tableContainer.style.display = 'block';
  } catch (error) {
    console.error('Error loading products:', error);
    loading.style.display = 'none';
    alert('Failed to load products: ' + error.message);
  }
}

/**
 * Open edit product modal
 */
function openEditProductModal(product) {
  const modal = document.getElementById('edit-product-modal');
  
  document.getElementById('edit-product-variety-id').value = product.product_variety_id;
  document.getElementById('edit-product-name').value = 
    `${product.product_variety.product_name} - ${product.product_variety.variety_name}`;
  document.getElementById('edit-quantity').value = product.quantity;
  document.getElementById('edit-rate').value = product.rate || '';
  document.getElementById('edit-amount').value = product.amount || '';
  
  // Populate unit dropdown
  const unitSelect = document.getElementById('edit-unit');
  unitSelect.innerHTML = `<option value="${product.unit}">${product.unit}</option>`;
  
  document.getElementById('edit-reason').value = '';
  
  modal.style.display = 'flex';
}

/**
 * Close edit product modal
 */
window.closeEditProductModal = function() {
  const modal = document.getElementById('edit-product-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

/**
 * Handle edit product form submission
 */
async function handleEditProduct(e) {
  e.preventDefault();
  
  const varietyId = document.getElementById('edit-product-variety-id').value;
  const quantity = parseFloat(document.getElementById('edit-quantity').value);
  const unit = document.getElementById('edit-unit').value;
  const rate = parseFloat(document.getElementById('edit-rate').value) || null;
  const amount = parseFloat(document.getElementById('edit-amount').value) || null;
  const reason = document.getElementById('edit-reason').value || null;
  
  // Show loading
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  
  try {
    const result = await productManager.updateProduct(
      varietyId,
      { quantity, unit, rate, amount },
      reason
    );
    
    if (result.success) {
      alert('Product updated successfully!');
      closeEditProductModal();
      await loadCurrentProducts();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error updating product:', error);
    alert('Failed to update product: ' + error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

/**
 * Open remove product modal
 */
function openRemoveProductModal(product) {
  const modal = document.getElementById('remove-product-modal');
  
  document.getElementById('remove-product-variety-id').value = product.product_variety_id;
  document.getElementById('remove-product-name').textContent = 
    `${product.product_variety.product_name} - ${product.product_variety.variety_name}`;
  document.getElementById('remove-reason').value = '';
  
  modal.style.display = 'flex';
}

/**
 * Close remove product modal
 */
window.closeRemoveProductModal = function() {
  const modal = document.getElementById('remove-product-modal');
  if (modal) {
    modal.style.display = 'none';
  }
};

/**
 * Confirm product removal
 */
window.confirmRemoveProduct = async function() {
  const varietyId = document.getElementById('remove-product-variety-id').value;
  const reason = document.getElementById('remove-reason').value || null;
  
  try {
    const result = await productManager.removeProduct(varietyId, reason);
    
    if (result.success) {
      alert('Product removed successfully!');
      closeRemoveProductModal();
      await loadCurrentProducts();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (error) {
    console.error('Error removing product:', error);
    alert('Failed to remove product: ' + error.message);
  }
};

/**
 * Load and display change history
 */
window.refreshChangeHistory = loadChangeHistory;

async function loadChangeHistory() {
  const loading = document.getElementById('change-history-loading');
  const empty = document.getElementById('change-history-empty');
  const timeline = document.getElementById('change-history-timeline');
  
  // Show loading
  loading.style.display = 'block';
  empty.style.display = 'none';
  timeline.innerHTML = '';
  
  try {
    const history = await productManager.getDetailedHistory(50);
    
    loading.style.display = 'none';
    
    if (history.length === 0) {
      empty.style.display = 'block';
      return;
    }
    
    // Populate timeline
    const template = document.getElementById('timeline-item-template');
    
    history.forEach(change => {
      const item = template.content.cloneNode(true);
      
      item.querySelector('.timeline-action').textContent = 
        ProductManager.formatAction(change.action);
      
      item.querySelector('.timeline-time').textContent = 
        formatDateTime(change.changed_at);
      
      item.querySelector('.timeline-product').textContent = 
        `${change.product_name} - ${change.variety_name}`;
      
      item.querySelector('.timeline-description').textContent = 
        ProductManager.formatChangeDescription(change);
      
      item.querySelector('.timeline-user').textContent = 
        `By ${change.changed_by_name || 'Unknown'} (${change.changed_by_role || 'N/A'})`;
      
      // Show reason if available
      if (change.change_reason) {
        item.querySelector('.timeline-reason').textContent = 
          `Reason: ${change.change_reason}`;
      } else {
        item.querySelector('.timeline-reason').remove();
      }
      
      timeline.appendChild(item);
    });
  } catch (error) {
    console.error('Error loading change history:', error);
    loading.style.display = 'none';
    alert('Failed to load change history: ' + error.message);
  }
}

/**
 * Format date/time for display
 */
function formatDateTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}
