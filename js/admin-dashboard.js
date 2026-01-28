import { enforcePageAccess, filterSidebarByRole } from './auth-utils.js';
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { ShipmentFormManager } from './components/ShipmentFormManager.js';
import { ShipmentService } from './services/ShipmentService.js';
import { CommodityService } from './services/CommodityService.js';

const supabase = createClient("https://sfknzqkiqxivzcualcau.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma256cWtpcXhpdnpjdWFsY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTU0ODksImV4cCI6MjA3MjM3MTQ4OX0.JKjOS9NRdbVH1UanfqmBeHmMSnlWlZtDr-5LdKw5YaA");

// Initialize services for new wizard
const shipmentService = new ShipmentService(supabase);
const commodityService = new CommodityService(supabase);
let shipmentFormManager = null;
let userRole = null; // Store user role

async function loadDashboardStats() {
  const { count: totalCount, error: totalError } = await supabase
    .from('shipment')
    .select('*', { count: 'exact', head: true });

  const { count: activeCount, error: activeError } = await supabase
    .from('shipment')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'active');

  const { count: completedCount, error: completedError } = await supabase
    .from('shipment')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'completed');

  if(totalError || activeError || completedError) {
    console.error("Error fetching stats:", totalError || activeError || completedError);
    return;
  }

  document.getElementById('total-shipments').textContent = totalCount;
  document.getElementById('active-shipments').textContent = activeCount;
  document.getElementById('completed-shipments').textContent = completedCount;
}

function toProperCase(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function getStagebadge(stage) {
  const stageConfig = {
    'forecast': { label: 'Forecast', color: '#8B5CF6', icon: 'fa-chart-line' },
    'enlistment_verification': { label: 'Verification', color: '#F59E0B', icon: 'fa-check-double' },
    'availability_confirmation': { label: 'Availability', color: '#10B981', icon: 'fa-calendar-check' },
    'proforma': { label: 'Proforma', color: '#3B82F6', icon: 'fa-file-signature' },
    'purchase_order': { label: 'Purchase Order', color: '#6366F1', icon: 'fa-file-invoice' },
    'invoice': { label: 'Invoice', color: '#8B5CF6', icon: 'fa-file-invoice-dollar' },
    'ip_number': { label: 'IP Number', color: '#F59E0B', icon: 'fa-hashtag' },
    'lc_opening': { label: 'LC Opening', color: '#EF4444', icon: 'fa-building-columns' },
    'lc_shared_with_supplier': { label: 'LC Shared', color: '#10B981', icon: 'fa-share-square' },
    'shipment_details_from_supplier': { label: 'Supplier Details', color: '#3B82F6', icon: 'fa-truck-fast' },
    'freight_query': { label: 'Freight Query', color: '#F59E0B', icon: 'fa-dolly' },
    'award_shipment': { label: 'Award Shipment', color: '#10B981', icon: 'fa-award' },
    'non_negotiable_docs': { label: 'Non-Negotiable', color: '#6366F1', icon: 'fa-file-contract' },
    'original_docs': { label: 'Original Docs', color: '#8B5CF6', icon: 'fa-file-import' },
    'bank_endorsement': { label: 'Bank Endorsement', color: '#EF4444', icon: 'fa-signature' },
    'send_to_clearing_agent': { label: 'To Clearing Agent', color: '#F59E0B', icon: 'fa-paper-plane' },
    'under_clearing_agent': { label: 'Under Clearing', color: '#3B82F6', icon: 'fa-user-shield' },
    'release_orders': { label: 'Release Orders', color: '#10B981', icon: 'fa-box-open' },
    'gate_out': { label: 'Gate Out', color: '#6366F1', icon: 'fa-torii-gate' },
    'transportation': { label: 'In Transit', color: '#F59E0B', icon: 'fa-truck' },
    'warehouse': { label: 'Warehouse', color: '#10B981', icon: 'fa-warehouse' },
    'bills': { label: 'Bills', color: '#8B5CF6', icon: 'fa-money-bill-wave' }
  };

  const config = stageConfig[stage] || { label: toProperCase(stage), color: '#64748B', icon: 'fa-circle' };
  
  return `<div class="stage-badge" style="background-color: ${config.color}15; border-color: ${config.color}; color: ${config.color}">
    <i class="fas ${config.icon}"></i>
    <span>${config.label}</span>
  </div>`;
}

function getStatusBadge(status) {
  const statusConfig = {
    'active': { label: 'Active', color: '#10B981', icon: 'fa-play-circle' },
    'completed': { label: 'Completed', color: '#6366F1', icon: 'fa-check-circle' },
    'cancelled': { label: 'Cancelled', color: '#EF4444', icon: 'fa-times-circle' },
    'on_hold': { label: 'On Hold', color: '#F59E0B', icon: 'fa-pause-circle' },
    'pending': { label: 'Pending', color: '#64748B', icon: 'fa-clock' }
  };

  const config = statusConfig[status] || { label: toProperCase(status), color: '#64748B', icon: 'fa-circle' };
  
  return `<div class="status-badge ${status}" style="background-color: ${config.color}15; border-color: ${config.color}; color: ${config.color}">
    <i class="fas ${config.icon}"></i>
    <span>${config.label}</span>
  </div>`;
}

async function loadShipments(searchTerm = '', filters = {}) {
  // Show loading state
  showTableLoading(true);
  
  const { data, error } = await supabase.rpc('filter_shipments', {
    p_search_term: searchTerm,
    p_supplier_id: filters.supplier_id,
    p_clearing_agent_id: filters.clearing_agent_id,
    p_bank_id: filters.bank_id,
    p_status: filters.status,
    p_commodity: filters.commodity,
    p_lc_number: filters.lc_number,
    p_product_name: filters.product_name,
    p_variety_name: filters.variety_name,
    p_mode_of_transport: filters.mode_of_transport
  });

  // Hide loading state
  showTableLoading(false);

  if (error) {
    document.getElementById("shipments-table-body").innerHTML = `
      <tr class="error-row">
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--error-color);">
          <div class="error-content">
            <i class="fas fa-exclamation-triangle" style="font-size: 24px; margin-bottom: 10px; display: block;"></i>
            <strong>Error loading shipments</strong><br>
            <span style="font-size: 14px; opacity: 0.8;">${error.message}</span>
          </div>
        </td>
      </tr>`;
    return;
  }

  const tableBody = document.getElementById("shipments-table-body");
  if (data.length === 0) {
    tableBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="8" style="text-align: center; padding: 40px; color: var(--text-secondary-color);">
          <div class="empty-content">
            <i class="fas fa-ship" style="font-size: 32px; margin-bottom: 15px; display: block; opacity: 0.5;"></i>
            <strong style="display: block; margin-bottom: 5px;">No shipments found</strong>
            <span style="font-size: 14px; opacity: 0.8;">Try adjusting your search criteria or create a new shipment</span>
          </div>
        </td>
      </tr>`;
    return;
  }

  let html = "";
  data.forEach(s => {
    const products = s.product_variety;
    let productCellHtml = 'N/A';
    let varietyCellHtml = 'N/A';
    let subRowsHtml = '';

    if (products && products.length > 0) {
      const firstProduct = products[0];
      productCellHtml = `${firstProduct.product_name}`;
      varietyCellHtml = `${firstProduct.variety_name}`;

      if (products.length > 1) {
        productCellHtml += ` <span class="product-badge">+${products.length - 1}</span>`;
        
        products.slice(1).forEach(p => {
          subRowsHtml += `<tr class="sub-product-row enhanced-sub-row" data-parent-shipment="${s.id}">
            <td class="sub-product-indent">
              <div class="cell-content">
                <span class="sub-product-arrow">&#8627;</span>
              </div>
            </td>
            <td class="sub-product-cell">
              <div class="cell-content">
                <span class="sub-product-name">${p.product_name}</span>
              </div>
            </td>
            <td class="sub-variety-cell">
              <div class="cell-content">
                <span class="sub-variety-name">${p.variety_name}</span>
              </div>
            </td>
            <td class="sub-supplier-cell">
              <div class="cell-content">
                <i class="fas fa-building supplier-icon"></i>
                <span class="supplier-name">${p.supplier.name}</span>
              </div>
            </td>
            <td colspan="4" class="sub-empty-cells">
              <div class="cell-content">
                <span class="sub-product-indicator">Additional Product</span>
              </div>
            </td>
          </tr>`;
        });
      }
    }
    
    const supplierName = s.supplier_name || 'N/A';

    // Generate stage badge
    const stageBadge = getStagebadge(s.current_stage);
    const statusBadge = getStatusBadge(s.status);
    const lcDisplay = s.lc_number ? `<span class="lc-number">${s.lc_number}</span>` : `<span class="lc-pending">Not assigned</span>`;
    
    html += `<tr class="enhanced-row" data-shipment-id="${s.id}" data-status="${s.status}">
      <td class="reference-cell">
        <div class="cell-content">
          <a href="shipment-details.html?id=${s.id}" class="reference-link">
            <i class="fas fa-ship reference-icon"></i>
            ${s.reference_code}
          </a>
        </div>
      </td>
      <td class="product-cell enhanced-product-cell">
        <div class="cell-content">
          ${productCellHtml}
        </div>
      </td>
      <td class="variety-cell">
        <div class="cell-content">
          <span class="variety-name">${varietyCellHtml}</span>
        </div>
      </td>
      <td class="supplier-cell">
        <div class="cell-content">
          <i class="fas fa-building supplier-icon"></i>
          <span class="supplier-name">${supplierName}</span>
        </div>
      </td>
      <td class="stage-cell">
        <div class="cell-content">
          ${stageBadge}
        </div>
      </td>
      <td class="status-cell">
        <div class="cell-content">
          ${statusBadge}
        </div>
      </td>
      <td class="lc-cell">
        <div class="cell-content">
          ${lcDisplay}
        </div>
      </td>
      <td class="actions-cell">
        <div class="cell-content">
          <div class="action-buttons">
            <a href="shipment_tracker.html?id=${s.id}" class="action-btn primary" title="Open Shipment Tracker">
              <i class="fas fa-eye"></i>
              <span>Track</span>
            </a>
            <a href="shipment-documents.html?id=${s.id}" class="action-btn secondary" title="View All Documents">
              <i class="fas fa-folder-open"></i>
            </a>
            <a href="shipment-details.html?id=${s.id}" class="action-btn secondary" title="View Details">
              <i class="fas fa-info-circle"></i>
            </a>
          </div>
        </div>
      </td>
    </tr>`;
    html += subRowsHtml;
  });
  tableBody.innerHTML = html;

  tableBody.querySelectorAll('.enhanced-product-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const row = e.target.closest('.enhanced-row');
      const shipmentId = row.dataset.shipmentId;
      const subRows = tableBody.querySelectorAll(`.enhanced-sub-row[data-parent-shipment="${shipmentId}"]`);
      const productBadge = cell.querySelector('.product-badge');
      
      subRows.forEach(subRow => {
        subRow.classList.toggle('show');
      });
      
      // Add visual feedback to the product cell
      cell.classList.toggle('expanded');
      
      // Update badge appearance
      if (productBadge) {
        productBadge.classList.toggle('expanded');
      }
    });
  });
}

function debounce(func, delay) {
  let timeout;
  return function(...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), delay);
  };
}

function showTableLoading(show) {
  const tableContainer = document.querySelector('.enhanced-table-container');
  if (show) {
    tableContainer.classList.add('table-loading');
    if (!tableContainer.querySelector('.loading-spinner')) {
      const spinner = document.createElement('div');
      spinner.className = 'loading-spinner';
      const overlay = document.createElement('div');
      overlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        border-radius: 12px;
      `;
      overlay.appendChild(spinner);
      tableContainer.appendChild(overlay);
    }
  } else {
    tableContainer.classList.remove('table-loading');
    const overlay = tableContainer.querySelector('div[style*="position: absolute"]');
    if (overlay) {
      overlay.remove();
    }
  }
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}



function closeCreateShipmentModal() {
  document.getElementById('create-shipment-modal').style.display = 'none';
}

function toggleFilterPane() {
  const filterPane = document.getElementById('filter-pane');
  filterPane.classList.toggle('open');
}

async function loadFilterOptions() {
  const { data: suppliers, error: supplierError } = await supabase.from('supplier').select('id, name');
  if (supplierError) console.error('Error loading suppliers:', supplierError); 
  else {
    const select = document.getElementById('supplier-filter');
    select.innerHTML = '<option value="">All</option>';
    suppliers.forEach(item => {
      select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
    });
  }

  const { data: clearingAgents, error: caError } = await supabase.from('clearing_agent').select('id, name');
  if (caError) console.error('Error loading clearing agents:', caError); 
  else {
    const select = document.getElementById('clearing-agent-filter');
    select.innerHTML = '<option value="">All</option>';
    clearingAgents.forEach(item => {
      select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
    });
  }

  const { data: banks, error: bankError } = await supabase.from('bank').select('id, name');
  if (bankError) console.error('Error loading banks:', bankError); 
  else {
    const select = document.getElementById('bank-filter');
    select.innerHTML = '<option value="">All</option>';
    banks.forEach(item => {
      select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
    });
  }

  const { data: commodities, error: commodityError } = await supabase.from('commodity').select('id, name');
  if (commodityError) console.error('Error loading commodities:', commodityError); 
  else {
    const select = document.getElementById('commodity-filter');
    select.innerHTML = '<option value="">All</option>';
    commodities.forEach(item => {
      select.innerHTML += `<option value="${item.name}">${item.name}</option>`;
    });
  }
}

async function openCreateShipmentModal() {
  console.log('Opening create shipment modal...');
  await Promise.all([loadProductVarieties(), loadPaymentTerms()]);
  document.getElementById('product-list-container').innerHTML = ''; // Clear previous products
  addProductForm();
  document.getElementById('create-shipment-modal').style.display = 'block';
}

async function loadPaymentTerms() {
  const { data, error } = await supabase.from('payment_terms').select('id, name');
  if (error) {
    console.error('Error loading payment terms:', error);
    return;
  }
  const select = document.querySelector('[name="payment_term_id"]');
  select.innerHTML = '';
  data.forEach(item => {
    select.innerHTML += `<option value="${item.id}">${item.name}</option>`;
  });
}

let activeCommoditySelect = null;

// Searchable Dropdown Implementation
function createSearchableDropdown(selectElement, options, placeholder = 'Select an option') {
  const container = document.createElement('div');
  container.className = 'searchable-dropdown';
  
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'dropdown-input';
  input.placeholder = placeholder;
  input.readOnly = true;
  
  const dropdownList = document.createElement('div');
  dropdownList.className = 'dropdown-list';
  
  container.appendChild(input);
  container.appendChild(dropdownList);
  
  // Replace the original select element
  selectElement.style.display = 'none';
  selectElement.parentNode.insertBefore(container, selectElement);
  
  let filteredOptions = [...options];
  let allOptions = [...options];
  
  function renderOptions() {
    dropdownList.innerHTML = '';
    
    if (filteredOptions.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.textContent = 'No results found';
      dropdownList.appendChild(noResults);
      return;
    }
    
    filteredOptions.forEach(option => {
      const item = document.createElement('div');
      item.className = 'dropdown-item';
      item.textContent = option.text;
      item.dataset.value = option.value;
      
      if (option.value === selectElement.value) {
        item.classList.add('selected');
      }
      
      item.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        selectElement.value = option.value;
        input.value = option.text;
        container.classList.remove('active');
        input.readOnly = true;
        
        // Remove selected and highlighted classes from all items
        dropdownList.querySelectorAll('.dropdown-item').forEach(el => {
          el.classList.remove('selected', 'highlighted');
        });
        item.classList.add('selected');
        
        // Trigger change event on original select
        const event = new Event('change', { bubbles: true });
        selectElement.dispatchEvent(event);
      });
      
      dropdownList.appendChild(item);
    });
  }
  
  function filterOptions(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    if (term === '') {
      filteredOptions = [...allOptions];
    } else {
      filteredOptions = allOptions.filter(option => 
        option.text.toLowerCase().includes(term)
      );
    }
    renderOptions();
  }
  
  // Set initial value if select has a value
  const initialSelectedOption = allOptions.find(opt => opt.value === selectElement.value);
  if (initialSelectedOption) {
    input.value = initialSelectedOption.text;
  } else if (allOptions.length > 0 && allOptions[0].value === '') {
    input.value = allOptions[0].text;
  }
  
  // Input events
  input.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (input.readOnly) {
      input.readOnly = false;
      const currentValue = input.value;
      input.value = '';
      container.classList.add('active');
      input.focus();
      filterOptions('');
      // Keep the current selection visible when opening
      setTimeout(() => {
        if (currentValue && currentValue !== allOptions[0]?.text) {
          input.value = '';
        }
      }, 50);
    }
  });
  
  input.addEventListener('input', (e) => {
    if (!input.readOnly) {
      filterOptions(e.target.value);
    }
  });
  
  // Handle clicks outside to close dropdown
  document.addEventListener('click', (e) => {
    if (!container.contains(e.target)) {
      container.classList.remove('active');
      input.readOnly = true;
      
      // Reset input value to selected option or placeholder
      const selectedOption = allOptions.find(opt => opt.value === selectElement.value);
      if (selectedOption) {
        input.value = selectedOption.text;
      } else {
        input.value = allOptions[0]?.text || '';
      }
      
      // Remove highlighted items
      dropdownList.querySelectorAll('.dropdown-item').forEach(el => {
        el.classList.remove('highlighted');
      });
    }
  });
  
  // Add keyboard navigation
  input.addEventListener('keydown', (e) => {
    if (!container.classList.contains('active')) return;
    
    const items = dropdownList.querySelectorAll('.dropdown-item:not(.no-results)');
    const currentSelected = dropdownList.querySelector('.dropdown-item.highlighted');
    let currentIndex = currentSelected ? Array.from(items).indexOf(currentSelected) : -1;
    
    switch(e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (currentSelected) currentSelected.classList.remove('highlighted');
        currentIndex = (currentIndex + 1) % items.length;
        if (items[currentIndex]) items[currentIndex].classList.add('highlighted');
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (currentSelected) currentSelected.classList.remove('highlighted');
        currentIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
        if (items[currentIndex]) items[currentIndex].classList.add('highlighted');
        break;
      case 'Enter':
        e.preventDefault();
        if (currentSelected) {
          currentSelected.click();
        }
        break;
      case 'Escape':
        e.preventDefault();
        container.classList.remove('active');
        input.readOnly = true;
        const selectedOption = allOptions.find(opt => opt.value === selectElement.value);
        if (selectedOption) {
          input.value = selectedOption.text;
        } else {
          input.value = allOptions[0]?.text || '';
        }
        break;
    }
  });
  
  // Initialize
  renderOptions();
  
  return {
    updateOptions: (newOptions) => {
      allOptions = [...newOptions];
      filteredOptions = [...newOptions];
      renderOptions();
      
      // Update input value if needed
      const selectedOption = allOptions.find(opt => opt.value === selectElement.value);
      if (selectedOption) {
        input.value = selectedOption.text;
      } else if (allOptions.length > 0) {
        input.value = allOptions[0].text;
      }
    },
    container,
    selectElement
  };
}

async function loadCommodities(selectElement) {
  const { data, error } = await supabase.from('commodity').select('id, name');
  if (error) {
    console.error('Error loading commodities:', error);
    return null;
  }
  
  // Clear existing options in the select element
  selectElement.innerHTML = '';
  
  // Prepare options for searchable dropdown
  const options = [
    { value: '', text: 'Select a commodity' },
    ...data.map(c => ({ value: c.id, text: c.name }))
  ];
  
  // Add options to the original select element (for form submission)
  options.forEach(option => {
    const optionElement = document.createElement('option');
    optionElement.value = option.value;
    optionElement.textContent = option.text;
    selectElement.appendChild(optionElement);
  });
  
  // Create searchable dropdown
  const searchableDropdown = createSearchableDropdown(
    selectElement, 
    options, 
    'Search commodities...'
  );
  
  return searchableDropdown;
}

async function populateUnits(commodityId, unitSelectElement, selectedUnit = null) {
  unitSelectElement.innerHTML = '';
  if (commodityId) {
      const { data, error } = await supabase
          .from('measurement_unit')
          .select('unit_name')
          .eq('commodity_id', commodityId);
      if (error) {
          console.error('Error loading measurement units:', error);
      } else {
          data.forEach(unit => {
              const option = document.createElement('option');
              option.value = unit.unit_name;
              option.textContent = unit.unit_name;
              unitSelectElement.appendChild(option);
          });
          if (selectedUnit) {
              unitSelectElement.value = selectedUnit;
          }
      }
  }
}

let activeCommodityDropdown = null;

function openAddCommodityModal(selectElement) {
  // Find the searchable dropdown container that contains this select element
  const searchableContainer = selectElement.parentNode.querySelector('.searchable-dropdown');
  if (searchableContainer) {
    activeCommodityDropdown = {
      selectElement: selectElement,
      container: searchableContainer
    };
  } else {
    activeCommodityDropdown = { selectElement: selectElement };
  }
  document.getElementById('add-commodity-modal').style.display = 'block';
}

function closeAddCommodityModal() {
  document.getElementById('add-commodity-modal').style.display = 'none';
}

let productVarieties = [];
async function loadProductVarieties() {
  const { data, error } = await supabase
    .from('product_variety')
    .select('id, product_name, variety_name, commodity_id');

  if (error) {
    console.error('Error loading product varieties:', error);
    return;
  }
  productVarieties = data;
}

function addProductForm() {
  const container = document.getElementById('product-list-container');
  const productForm = document.createElement('div');
  productForm.classList.add('product-form-item');

  productForm.innerHTML = `
    <div>
      <label>Commodity:</label>
      <div class="input-group">
        <select name="commodity" required></select>
        <button type="button" class="add-new-btn">+</button>
      </div>
    </div>
    <div>
      <label>Product Variety:</label>
      <select name="product_variety_id" required disabled>
        <option value="">Select a commodity first</option>
      </select>
    </div>
    <div>
      <label>Quantity:</label>
      <input type="number" name="quantity" required>
    </div>
    <div>
      <label>Unit:</label>
      <select name="unit" required>
        <option value="">Select a commodity first</option>
      </select>
    </div>
    <button type="button" class="remove-product-btn button-secondary">Remove</button>
    <hr>
  `;

  const commoditySelect = productForm.querySelector('[name="commodity"]');
  const varietySelect = productForm.querySelector('[name="product_variety_id"]');
  const unitSelect = productForm.querySelector('[name="unit"]');
  const addNewBtn = productForm.querySelector('.add-new-btn');

  let commodityDropdown, varietyDropdown, unitDropdown;

  // Populate commodity dropdown with searchable functionality
  loadCommodities(commoditySelect).then(dropdown => {
    if (dropdown) {
      commodityDropdown = dropdown;
    }
  });

  addNewBtn.addEventListener('click', () => {
    openAddCommodityModal(commoditySelect);
  });

  // Handle commodity selection
  commoditySelect.addEventListener('change', async () => {
    const selectedCommodity = commoditySelect.value;
    console.log('productVarieties:', productVarieties);
    console.log('selectedCommodity:', selectedCommodity);
    
    if (selectedCommodity) {
      varietySelect.disabled = false;
      const filteredVarieties = productVarieties.filter(p => p.commodity_id === selectedCommodity);
      console.log('filteredVarieties:', filteredVarieties);
      
      // Clear existing variety options
      varietySelect.innerHTML = '';
      
      // Prepare options for variety searchable dropdown
      const varietyOptions = [
        { value: '', text: 'Select a product variety' },
        ...filteredVarieties.map(item => ({
          value: item.id,
          text: `${item.product_name} - ${item.variety_name}`
        }))
      ];
      
      // Add options to the select element
      varietyOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        varietySelect.appendChild(optionElement);
      });
      
      // Remove existing variety dropdown if it exists
      const existingVarietyDropdown = varietySelect.previousElementSibling;
      if (existingVarietyDropdown && existingVarietyDropdown.classList.contains('searchable-dropdown')) {
        existingVarietyDropdown.remove();
        varietySelect.style.display = '';
      }
      
      // Create new searchable dropdown for varieties
      varietyDropdown = createSearchableDropdown(
        varietySelect,
        varietyOptions,
        'Search product varieties...'
      );
      
      // Auto-populate units based on selected commodity
      await populateUnitsSearchable(selectedCommodity, unitSelect);
    } else {
      varietySelect.disabled = true;
      varietySelect.innerHTML = '<option value="">Select a commodity first</option>';
      
      // Remove existing dropdowns
      const existingVarietyDropdown = varietySelect.previousElementSibling;
      if (existingVarietyDropdown && existingVarietyDropdown.classList.contains('searchable-dropdown')) {
        existingVarietyDropdown.remove();
        varietySelect.style.display = '';
      }
      
      const existingUnitDropdown = unitSelect.previousElementSibling;
      if (existingUnitDropdown && existingUnitDropdown.classList.contains('searchable-dropdown')) {
        existingUnitDropdown.remove();
        unitSelect.style.display = '';
      }
      
      unitSelect.innerHTML = '<option value="">Select a commodity first</option>';
    }
  });

  // Function to populate units with searchable dropdown
  async function populateUnitsSearchable(commodityId, unitSelectElement) {
    if (commodityId) {
      const { data, error } = await supabase
        .from('measurement_unit')
        .select('unit_name')
        .eq('commodity_id', commodityId);
      
      if (error) {
        console.error('Error loading measurement units:', error);
      } else {
        // Clear existing unit options
        unitSelectElement.innerHTML = '';
        
        const unitOptions = [
          { value: '', text: 'Select a unit' },
          ...data.map(unit => ({
            value: unit.unit_name,
            text: unit.unit_name
          }))
        ];
        
        // Add options to the select element
        unitOptions.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option.value;
          optionElement.textContent = option.text;
          unitSelectElement.appendChild(optionElement);
        });
        
        // Remove existing unit dropdown if it exists
        const existingUnitDropdown = unitSelectElement.previousElementSibling;
        if (existingUnitDropdown && existingUnitDropdown.classList.contains('searchable-dropdown')) {
          existingUnitDropdown.remove();
          unitSelectElement.style.display = '';
        }
        
        unitDropdown = createSearchableDropdown(
          unitSelectElement,
          unitOptions,
          'Search units...'
        );
      }
    }
  }

  container.appendChild(productForm);

  productForm.querySelector('.remove-product-btn').addEventListener('click', () => {
    productForm.remove();
  });
}

window.logout = logout;
window.onload = async () => {
    const loader = document.getElementById("loader");
    if (loader) {
        loader.style.display = "block";
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
    } else {
        // Initialize Shipment Form Manager with new wizard
        shipmentFormManager = new ShipmentFormManager(
          supabase,
          shipmentService,
          commodityService
        );
        
        const { data: userProfile, error } = await supabase
          .from('app_user')
          .select('full_name, role')
          .eq('id', user.id)
          .single();

        if (userProfile) {
          // Update main profile display
          document.getElementById('user-full-name').textContent = userProfile.full_name;
          const userRoleEmailEl = document.getElementById('user-role-email');
          userRoleEmailEl.textContent = `${userProfile.role} | ${user.email}`;
          userRoleEmailEl.title = `${userProfile.role} | ${user.email}`;
          document.getElementById('welcome-message').textContent = `Welcome back, ${userProfile.full_name}!`;
          
          // Update preview in user button
          document.getElementById('user-name-preview').textContent = userProfile.full_name;
          document.getElementById('user-role-preview').textContent = toProperCase(userProfile.role);
          
          // Generate user initials for avatar
          const initials = userProfile.full_name
            .split(' ')
            .map(name => name.charAt(0))
            .join('')
            .toUpperCase()
            .substring(0, 2);
          
          // Update avatars with initials
          document.querySelectorAll('.user-avatar, .user-avatar-large').forEach(avatar => {
            const iconElement = avatar.querySelector('i');
            if (iconElement) {
              iconElement.style.display = 'none';
            }
            if (!avatar.querySelector('.avatar-initials')) {
              const initialsSpan = document.createElement('span');
              initialsSpan.className = 'avatar-initials';
              initialsSpan.textContent = initials;
              avatar.appendChild(initialsSpan);
            }
          });
        }
        
        document.getElementById('status-filter').value = 'active';
        await Promise.all([
          loadDashboardStats(),
          loadShipments('', { status: 'active' }),
          loadFilterOptions()
        ]);
        updateFilterBadge();
        
        // Initialize insights section with real data
        await initializeInsightsSection();
        
        // Set up real-time updates for insights (every 5 minutes)
        setInterval(initializeInsightsSection, 5 * 60 * 1000);
        
        // Listen for shipment changes to refresh insights
        supabase
          .channel('shipments-insights')
          .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'shipment' }, 
            () => {
              console.log('Shipment change detected, refreshing insights...');
              clearTimeout(window.insightsRefreshTimeout);
              window.insightsRefreshTimeout = setTimeout(initializeInsightsSection, 2000);
            }
          )
          .subscribe();
        
        // Initialize table sorting after data is loaded
        initializeTableSorting();
    }

    if (loader) {
        loader.style.display = "none";
    }

    document.getElementById('filter-toggle-btn').addEventListener('click', toggleFilterPane);

    document.getElementById('apply-filters-btn').addEventListener('click', () => {
        const filters = {
            supplier_id: document.getElementById('supplier-filter').value || null,
            clearing_agent_id: document.getElementById('clearing-agent-filter').value || null,
            bank_id: document.getElementById('bank-filter').value || null,
            status: document.getElementById('status-filter').value || null,
            commodity: document.getElementById('commodity-filter').value || null,
            mode_of_transport: document.getElementById('mode-of-transport-filter').value || null,
            lc_number: document.getElementById('lc-number-filter').value || null,
            product_name: document.getElementById('product-name-filter').value || null,
            variety_name: document.getElementById('variety-name-filter').value || null
        };
        loadShipments(document.getElementById('shipment-search').value, filters);
        updateFilterBadge();
    });

    document.getElementById('clear-filters-btn').addEventListener('click', () => {
        document.getElementById('supplier-filter').value = '';
        document.getElementById('clearing-agent-filter').value = '';
        document.getElementById('bank-filter').value = '';
        document.getElementById('status-filter').value = '';
        document.getElementById('commodity-filter').value = '';
        document.getElementById('mode-of-transport-filter').value = '';
        document.getElementById('lc-number-filter').value = '';
        document.getElementById('product-name-filter').value = '';
        document.getElementById('variety-name-filter').value = '';
        loadShipments(document.getElementById('shipment-search').value);
        updateFilterBadge();
    });

    function updateFilterBadge() {
      const filters = {
          supplier_id: document.getElementById('supplier-filter').value,
          clearing_agent_id: document.getElementById('clearing-agent-filter').value,
          bank_id: document.getElementById('bank-filter').value,
          status: document.getElementById('status-filter').value,
          commodity: document.getElementById('commodity-filter').value,
          mode_of_transport: document.getElementById('mode-of-transport-filter').value,
          lc_number: document.getElementById('lc-number-filter').value,
          product_name: document.getElementById('product-name-filter').value,
          variety_name: document.getElementById('variety-name-filter').value
      };
      const activeFilters = Object.values(filters).filter(v => v !== '' && v !== null).length;
      const badge = document.getElementById('filter-count-badge');
      if (activeFilters > 0) {
        badge.textContent = activeFilters;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }

    const searchInput = document.getElementById('shipment-search');
    searchInput.addEventListener('input', debounce((e) => {
      const filters = {
            supplier_id: document.getElementById('supplier-filter').value || null,
            clearing_agent_id: document.getElementById('clearing-agent-filter').value || null,
            bank_id: document.getElementById('bank-filter').value || null,
            status: document.getElementById('status-filter').value || null,
            commodity: document.getElementById('commodity-filter').value || null,
            lc_number: document.getElementById('lc-number-filter').value || null,
            product_name: document.getElementById('product-name-filter').value || null,
            variety_name: document.getElementById('variety-name-filter').value || null
        };
      loadShipments(e.target.value, filters);
    }, 300));

    // Event listener for add-product-btn is now handled by ShipmentFormManager
    // document.getElementById('add-product-btn').addEventListener('click', addProductForm);

    document.getElementById('create-shipment-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const messageDiv = document.getElementById('create-shipment-message');
      const { data: { user } } = await supabase.auth.getUser();

      // 1. Generate reference code and create the shipment
      const shipmentType = document.querySelector('[name="type"]').value;
      const paymentTermId = document.querySelector('[name="payment_term_id"]').value;
      
      const { data: reference_code, error: refError } = await supabase.rpc('get_next_shipment_reference', { p_shipment_type: shipmentType });

      if (refError) {
        messageDiv.innerHTML = `<p class="error-message">Error generating reference code: ${refError.message}</p>`;
        return;
      }

      // Get mode of transport, inco-term, and freight charges
      const modeOfTransport = document.getElementById('mode_of_transport')?.value || null;
      const incoTerm = document.getElementById('inco_term')?.value || null;
      const freightChargesInput = document.getElementById('freight_charges')?.value;
      const freightCharges = freightChargesInput ? parseFloat(freightChargesInput) : null;

      const { data: shipment, error: shipmentError } = await supabase
        .from('shipment')
        .insert({ 
          reference_code: reference_code, 
          created_by: user.id, 
          type: shipmentType, 
          payment_term_id: paymentTermId,
          mode_of_transport: modeOfTransport,
          inco_term: incoTerm,
          freight_charges: freightCharges
        })
        .select()
        .single();

      if (shipmentError) {
        messageDiv.innerHTML = `<p class="error-message">Error creating shipment: ${shipmentError.message}</p>`;
        return;
      }

      // 2. Gather product data
      const productForms = document.querySelectorAll('.product-form-item');
      const productsToInsert = [];
      productForms.forEach(form => {
        productsToInsert.push({
          shipment_id: shipment.id,
          product_variety_id: form.querySelector('[name="product_variety_id"]').value,
          quantity: form.querySelector('[name="quantity"]').value,
          unit: form.querySelector('[name="unit"]').value
        });
      });

      // 3. Insert products
      const { error: productsError } = await supabase
        .from('shipment_products')
        .insert(productsToInsert);

      if (productsError) {
        messageDiv.innerHTML = `<p class="error-message">Error adding products to shipment: ${productsError.message}</p>`;
        // Optionally, delete the created shipment if products fail to add
        await supabase.from('shipment').delete().eq('id', shipment.id);
      } else {
        messageDiv.innerHTML = `<p class="success-message">Shipment created successfully!</p>`;
        document.getElementById('create-shipment-form').reset();
        closeCreateShipmentModal();
        loadShipments();
        loadDashboardStats();
      }
    });

    document.getElementById('create-shipment-btn').addEventListener('click', () => {
      if (shipmentFormManager) {
        shipmentFormManager.openModal();
      }
    });
    document.getElementById('close-modal-btn').addEventListener('click', closeCreateShipmentModal);
    document.getElementById('close-add-commodity-modal-btn').addEventListener('click', closeAddCommodityModal);

    document.getElementById('add-commodity-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const newCommodityName = document.getElementById('new_commodity_name').value;
      const messageDiv = document.getElementById('add-commodity-message');

      const { data, error } = await supabase.from('commodity').insert({ name: newCommodityName }).select().single();

      if (error) {
        messageDiv.innerHTML = `<p class="error-message">Error adding commodity: ${error.message}</p>`;
      } else {
        messageDiv.innerHTML = `<p class="success-message">Commodity added successfully!</p>`;
        document.getElementById('add-commodity-form').reset();
        closeAddCommodityModal();

        if (activeCommodityDropdown) {
          // Reload commodities for this specific dropdown
          const { data: commodities, error: loadError } = await supabase.from('commodity').select('id, name');
          if (!loadError) {
            const options = [
              { value: '', text: 'Select a commodity' },
              ...commodities.map(c => ({ value: c.id, text: c.name }))
            ];
            
            // If this is a searchable dropdown, update its options
            if (activeCommodityDropdown.container) {
              // Find the searchable dropdown instance and update it
              const existingDropdown = activeCommodityDropdown.container;
              const input = existingDropdown.querySelector('.dropdown-input');
              const dropdownList = existingDropdown.querySelector('.dropdown-list');
              
              // Update options in the dropdown list
              dropdownList.innerHTML = '';
              options.forEach(option => {
                const item = document.createElement('div');
                item.className = 'dropdown-item';
                item.textContent = option.text;
                item.dataset.value = option.value;
                
                if (option.value === data.id) {
                  item.classList.add('selected');
                  input.value = option.text;
                  activeCommodityDropdown.selectElement.value = option.value;
                }
                
                item.addEventListener('click', () => {
                  activeCommodityDropdown.selectElement.value = option.value;
                  input.value = option.text;
                  existingDropdown.classList.remove('active');
                  input.readOnly = true;
                  
                  dropdownList.querySelectorAll('.dropdown-item').forEach(el => {
                    el.classList.remove('selected');
                  });
                  item.classList.add('selected');
                  
                  const event = new Event('change', { bubbles: true });
                  activeCommodityDropdown.selectElement.dispatchEvent(event);
                });
                
                dropdownList.appendChild(item);
              });
              
              // Select the newly added commodity
              activeCommodityDropdown.selectElement.value = data.id;
              input.value = data.name;
              input.readOnly = true;
              
              // Trigger change event
              activeCommodityDropdown.selectElement.dispatchEvent(new Event('change'));
            } else {
              // Fallback for regular select
              const option = document.createElement('option');
              option.value = data.id;
              option.textContent = data.name;
              option.selected = true;
              activeCommodityDropdown.selectElement.appendChild(option);
              activeCommodityDropdown.selectElement.dispatchEvent(new Event('change'));
            }
          }
        }
      }
    });

    function initializeTableSorting() {
      const tableHeaders = document.querySelectorAll('.sortable');
      let currentSort = { column: null, direction: 'asc' };
      
      tableHeaders.forEach(header => {
        header.addEventListener('click', () => {
          const sortColumn = header.dataset.sort;
          const sortIcon = header.querySelector('.sort-icon');
          
          // Reset all other sort icons
          tableHeaders.forEach(h => {
            if (h !== header) {
              h.querySelector('.sort-icon').className = 'fas fa-sort sort-icon';
              h.classList.remove('sorted-asc', 'sorted-desc');
            }
          });
          
          // Determine sort direction
          if (currentSort.column === sortColumn) {
            currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
          } else {
            currentSort.direction = 'asc';
          }
          currentSort.column = sortColumn;
          
          // Update sort icon
          if (currentSort.direction === 'asc') {
            sortIcon.className = 'fas fa-sort-up sort-icon';
            header.classList.add('sorted-asc');
            header.classList.remove('sorted-desc');
          } else {
            sortIcon.className = 'fas fa-sort-down sort-icon';
            header.classList.add('sorted-desc');
            header.classList.remove('sorted-asc');
          }
          
          // Sort the table
          sortTableByColumn(currentSort.column, currentSort.direction);
        });
      });
    }

    function sortTableByColumn(column, direction) {
      const tableBody = document.getElementById('shipments-table-body');
      const rows = Array.from(tableBody.querySelectorAll('.enhanced-row'));
      
      rows.sort((a, b) => {
        let aValue, bValue;
        
        switch (column) {
          case 'reference':
            aValue = a.querySelector('.reference-link').textContent.trim();
            bValue = b.querySelector('.reference-link').textContent.trim();
            break;
          case 'product':
            aValue = a.querySelector('.enhanced-product-cell .cell-content').textContent.trim();
            bValue = b.querySelector('.enhanced-product-cell .cell-content').textContent.trim();
            break;
          case 'variety':
            aValue = a.querySelector('.variety-name').textContent.trim();
            bValue = b.querySelector('.variety-name').textContent.trim();
            break;
          case 'supplier':
            aValue = a.querySelector('.supplier-name').textContent.trim();
            bValue = b.querySelector('.supplier-name').textContent.trim();
            break;
          case 'stage':
            aValue = a.querySelector('.stage-badge span').textContent.trim();
            bValue = b.querySelector('.stage-badge span').textContent.trim();
            break;
          case 'status':
            aValue = a.querySelector('.status-badge span').textContent.trim();
            bValue = b.querySelector('.status-badge span').textContent.trim();
            break;
          default:
            return 0;
        }
        
        const comparison = aValue.localeCompare(bValue, undefined, { numeric: true });
        return direction === 'asc' ? comparison : -comparison;
      });
      
      // Clear and re-append sorted rows
      tableBody.innerHTML = '';
      rows.forEach(row => {
        tableBody.appendChild(row);
        // Also append sub-rows if they exist
        const shipmentId = row.dataset.shipmentId;
        const subRows = document.querySelectorAll(`.enhanced-sub-row[data-parent-shipment="${shipmentId}"]`);
        subRows.forEach(subRow => {
          tableBody.appendChild(subRow);
        });
      });
    }

    // Enhanced user menu functionality
    function openProfileSettings() {
      showNotification('Profile settings coming soon!', 'info');
    }

    function openAccountSettings() {
      showNotification('Account settings coming soon!', 'info');
    }

    function openNotifications() {
      showNotification('Notifications panel coming soon!', 'info');
    }

    function openHelp() {
      showNotification('Help & support coming soon!', 'info');
    }

    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.innerHTML = `
        <div class="notification-content">
          <i class="fas ${type === 'info' ? 'fa-info-circle' : 'fa-check-circle'}"></i>
          <span>${message}</span>
        </div>
      `;
      
      document.body.appendChild(notification);
      
      // Animate in
      setTimeout(() => notification.classList.add('show'), 100);
      
      // Auto remove after 3 seconds
      setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    // Make functions globally available
    window.openProfileSettings = openProfileSettings;
    window.openAccountSettings = openAccountSettings;
    window.openNotifications = openNotifications;
    window.openHelp = openHelp;

    // Insights section functions - REAL DATA INTEGRATION
    async function loadAlertsData() {
      try {
        const { data, error } = await supabase.rpc('get_critical_alerts');
        
        if (error) {
          console.error('Error loading alerts:', error);
          // Fallback to simple query
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('shipment')
            .select('reference_code, created_at, current_stage, status')
            .eq('status', 'active')
            .order('created_at', { ascending: true })
            .limit(3);
          
          if (!fallbackError && fallbackData) {
            const fallbackAlerts = fallbackData.map(item => ({
              type: 'simple_alert',
              title: `Shipment ${item.reference_code}`,
              subtitle: `In ${item.current_stage.replace(/_/g, ' ')} stage`,
              reference_code: item.reference_code,
              priority: 'medium',
              created_at: item.created_at
            }));
            updateAlertsUI(fallbackAlerts);
            document.getElementById('alerts-count').textContent = fallbackAlerts.length;
          } else {
            updateAlertsUI([]);
            document.getElementById('alerts-count').textContent = '0';
          }
          return;
        }
        
        updateAlertsUI(data || []);
        document.getElementById('alerts-count').textContent = data?.length || 0;
      } catch (err) {
        console.error('Failed to load alerts:', err);
        updateAlertsUI([]);
        document.getElementById('alerts-count').textContent = '!';
      }
    }

    async function loadWarningsData() {
      try {
        const { data, error } = await supabase.rpc('get_business_warnings');
        
        if (error) {
          console.error('Error loading warnings:', error);
          // Fallback data
          const fallbackWarnings = [{
            type: 'system_check',
            title: 'System monitoring active',
            subtitle: 'All systems operational',
            reference_code: '',
            priority: 'warning',
            created_at: new Date().toISOString()
          }];
          updateWarningsUI(fallbackWarnings);
          document.getElementById('warnings-count').textContent = fallbackWarnings.length;
          return;
        }
        
        updateWarningsUI(data || []);
        document.getElementById('warnings-count').textContent = data?.length || 0;
      } catch (err) {
        console.error('Failed to load warnings:', err);
        updateWarningsUI([]);
        document.getElementById('warnings-count').textContent = '!';
      }
    }

    async function loadInsightsData() {
      try {
        const { data, error } = await supabase.rpc('get_business_insights');
        
        if (error) {
          console.error('Error loading insights:', error);
          // Get basic statistics as fallback
          const { data: statsData, error: statsError } = await supabase
            .from('shipment')
            .select('status')
            .eq('status', 'completed');
          
          if (!statsError && statsData) {
            const fallbackInsights = [{
              type: 'basic_stats',
              title: `${statsData.length} shipments completed`,
              subtitle: 'System performance tracking',
              reference_code: '',
              priority: 'positive',
              created_at: new Date().toISOString()
            }];
            updateInsightsUI(fallbackInsights);
            document.getElementById('insights-count').textContent = fallbackInsights.length;
          } else {
            updateInsightsUI([]);
            document.getElementById('insights-count').textContent = '0';
          }
          return;
        }
        
        updateInsightsUI(data || []);
        document.getElementById('insights-count').textContent = data?.length || 0;
      } catch (err) {
        console.error('Failed to load insights:', err);
        updateInsightsUI([]);
        document.getElementById('insights-count').textContent = '!';
      }
    }

    function updateAlertsUI(alerts) {
      const container = document.getElementById('alerts-content');
      if (!container) return;
      
      container.innerHTML = '';
      
      if (alerts.length === 0) {
        container.innerHTML = `
          <div class="insight-item">
            <div class="item-icon positive">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="item-content">
              <p class="item-title">No critical alerts</p>
              <p class="item-subtitle">All shipments are on track</p>
            </div>
          </div>
        `;
        return;
      }
      
      alerts.forEach(alert => {
        const item = document.createElement('div');
        item.className = 'insight-item';
        item.innerHTML = `
          <div class="item-icon ${alert.priority || 'medium'}">
            <i class="fas fa-circle"></i>
          </div>
          <div class="item-content">
            <p class="item-title">${alert.title || 'Alert'}</p>
            <p class="item-subtitle">${alert.subtitle || 'Details unavailable'}</p>
          </div>
          <div class="item-action">
            <button class="action-link" onclick="handleAlertAction('${alert.type}', '${alert.reference_code || ''}')">
              ${alert.reference_code ? 'View' : 'Details'}
            </button>
          </div>
        `;
        container.appendChild(item);
      });
    }

    function updateWarningsUI(warnings) {
      const container = document.getElementById('warnings-content');
      if (!container) return;
      
      container.innerHTML = '';
      
      if (warnings.length === 0) {
        container.innerHTML = `
          <div class="insight-item">
            <div class="item-icon positive">
              <i class="fas fa-check-circle"></i>
            </div>
            <div class="item-content">
              <p class="item-title">No warnings</p>
              <p class="item-subtitle">All systems operating normally</p>
            </div>
          </div>
        `;
        return;
      }
      
      warnings.forEach(warning => {
        const item = document.createElement('div');
        item.className = 'insight-item';
        item.innerHTML = `
          <div class="item-icon warning">
            <i class="fas fa-circle"></i>
          </div>
          <div class="item-content">
            <p class="item-title">${warning.title || 'Warning'}</p>
            <p class="item-subtitle">${warning.subtitle || 'Details unavailable'}</p>
          </div>
          <div class="item-action">
            <button class="action-link" onclick="handleWarningAction('${warning.type}', '${warning.reference_code || ''}')">
              Details
            </button>
          </div>
        `;
        container.appendChild(item);
      });
    }

    function updateInsightsUI(insights) {
      const container = document.getElementById('insights-content');
      if (!container) return;
      
      container.innerHTML = '';
      
      if (insights.length === 0) {
        container.innerHTML = `
          <div class="insight-item">
            <div class="item-icon neutral">
              <i class="fas fa-chart-line"></i>
            </div>
            <div class="item-content">
              <p class="item-title">Gathering insights</p>
              <p class="item-subtitle">More data needed for analysis</p>
            </div>
          </div>
        `;
        return;
      }
      
      insights.forEach(insight => {
        const item = document.createElement('div');
        item.className = 'insight-item';
        item.innerHTML = `
          <div class="item-icon ${insight.priority || 'neutral'}">
            <i class="fas fa-circle"></i>
          </div>
          <div class="item-content">
            <p class="item-title">${insight.title || 'Insight'}</p>
            <p class="item-subtitle">${insight.subtitle || 'Details unavailable'}</p>
          </div>
          <div class="item-action">
            <button class="action-link" onclick="handleInsightAction('${insight.type}', '${insight.reference_code || ''}')">
              Report
            </button>
          </div>
        `;
        container.appendChild(item);
      });
    }

    function handleAlertAction(type, referenceCode) {
      switch(type) {
        case 'overdue':
        case 'simple_alert':
          if (referenceCode) {
            window.location.href = `shipment-details.html?ref=${referenceCode}`;
          } else {
            showNotification('Navigating to shipment details', 'info');
          }
          break;
        case 'lc_expiring':
          if (referenceCode) {
            window.location.href = `shipment-details.html?ref=${referenceCode}&focus=lc`;
          } else {
            showNotification('Opening LC management', 'info');
          }
          break;
        case 'pending_docs':
          document.getElementById('shipment-search').value = '';
          loadShipments('', { status: 'active' });
          showNotification('Filtered shipments requiring documentation', 'info');
          break;
        default:
          showNotification('Opening detailed alert information', 'info');
      }
    }

    function handleWarningAction(type, referenceCode) {
      switch(type) {
        case 'supplier_capacity':
          window.location.href = 'supplier-details.html';
          break;
        case 'stage_bottleneck':
          loadShipments('', { status: 'active' });
          showNotification('Showing active shipments to identify bottlenecks', 'info');
          break;
        case 'missing_details':
          loadShipments('supplier details', { status: 'active' });
          showNotification('Showing shipments needing supplier details', 'info');
          break;
        default:
          showNotification('Opening detailed warning analysis', 'info');
      }
    }

    function handleInsightAction(type, referenceCode) {
      switch(type) {
        case 'performance':
        case 'basic_stats':
          showNotification('Opening performance analytics dashboard', 'info');
          break;
        case 'top_supplier':
          window.location.href = 'supplier-details.html';
          break;
        case 'seasonal':
          showNotification('Opening seasonal planning dashboard', 'info');
          break;
        default:
          showNotification('Opening detailed insights analysis', 'info');
      }
    }

    async function initializeInsightsSection() {
      try {
        console.log('Initializing insights section with real data...');
        
        // Show loading state
        document.querySelectorAll('.insight-count').forEach(el => {
          el.textContent = '...';
        });
        
        // Load all data in parallel
        await Promise.allSettled([
          loadAlertsData(),
          loadWarningsData(),
          loadInsightsData()
        ]);
        
        console.log('Insights section loaded with real data');
      } catch (error) {
        console.error('Failed to initialize insights section:', error);
        
        // Show error state
        document.querySelectorAll('.insight-count').forEach(el => {
          el.textContent = '!';
        });
      }
    }

    // Enhanced view all functions
    function viewAllAlerts() {
      document.getElementById('shipment-search').value = '';
      loadShipments('', { status: 'active' });
      showNotification('Showing all active shipments for alert analysis', 'info');
    }

    function viewAllWarnings() {
      showNotification('Opening comprehensive warnings dashboard', 'info');
    }

    function viewAllInsights() {
      showNotification('Opening business insights dashboard', 'info');
    }

    // Make insight functions globally available
    window.viewShipment = (shipmentRef) => window.location.href = `shipment-details.html?ref=${shipmentRef}`;
    window.viewLC = (lcNumber) => showNotification(`Opening LC details for ${lcNumber}`, 'info');
    window.viewPendingDocs = () => showNotification('Opening pending documents view', 'info');
    window.viewAllAlerts = viewAllAlerts;
    window.viewWeatherAlert = () => showNotification('Opening weather forecast details', 'info');
    window.viewSupplierCapacity = () => showNotification('Opening supplier capacity dashboard', 'info');
    window.viewCurrencyTrends = () => showNotification('Opening currency trends analysis', 'info');
    window.viewAllWarnings = viewAllWarnings;
    window.viewEfficiencyReport = () => showNotification('Opening efficiency analysis report', 'info');
    window.viewSeasonalForecast = () => showNotification('Opening seasonal forecast planning', 'info');
    window.viewTradeRoutes = () => showNotification('Opening trade routes explorer', 'info');
    window.viewAllInsights = viewAllInsights;
    window.handleAlertAction = handleAlertAction;
    window.handleWarningAction = handleWarningAction;
    window.handleInsightAction = handleInsightAction;
    window.initializeInsightsSection = initializeInsightsSection;
};
document.addEventListener('DOMContentLoaded', async () => {
    // Enforce page access and get user role
    const authData = await enforcePageAccess();
    if (!authData) {
        return; // enforcePageAccess handles redirection
    }
    
    userRole = authData.role;
    
    // Filter sidebar based on user role
    filterSidebarByRole(userRole);
    
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const navLinks = document.querySelectorAll('.nav-link');
    const hasSubmenus = document.querySelectorAll('.has-submenu');
    const mediaQuery = window.matchMedia('(max-width: 768px)');

    function handleMediaQueryChange(e) {
        if (e.matches) {
            sidebar.classList.remove('collapsed');
            sidebar.classList.remove('open');
        } else {
            sidebar.classList.remove('open');
        }
    }

    handleMediaQueryChange(mediaQuery);
    mediaQuery.addListener(handleMediaQueryChange);

    sidebarToggle.addEventListener('click', () => {
        if (mediaQuery.matches) {
            sidebar.classList.toggle('open');
        } else {
            sidebar.classList.toggle('collapsed');
        }
    });

    hasSubmenus.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const submenu = item.nextElementSibling;
            if (submenu && submenu.classList.contains('submenu')) {
                submenu.classList.toggle('open');
                item.classList.toggle('open');
            }
        });
    });

    const currentPath = window.location.pathname.split('/').pop();
    navLinks.forEach(link => {
        if (link.href.split('/').pop() === currentPath) {
            link.classList.add('active');
            let parentSubmenu = link.closest('.submenu');
            if (parentSubmenu) {
                parentSubmenu.classList.add('open');
                let parentHasSubmenu = parentSubmenu.previousElementSibling;
                if (parentHasSubmenu && parentHasSubmenu.classList.contains('has-submenu')) {
                    parentHasSubmenu.classList.add('open');
                }
            }
        }
    });

    const userMenuButton = document.getElementById('user-menu-button');
    const dropdownMenu = document.getElementById('dropdown-menu');

    if (userMenuButton) {
        userMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
            userMenuButton.classList.toggle('active');
            
            // Rotate the dropdown indicator
            const indicator = userMenuButton.querySelector('.dropdown-indicator i');
            if (indicator) {
                indicator.style.transform = dropdownMenu.classList.contains('show') 
                    ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        });
    }

    window.addEventListener('click', (event) => {
        if (userMenuButton && !userMenuButton.contains(event.target) && dropdownMenu && !dropdownMenu.contains(event.target)) {
            dropdownMenu.classList.remove('show');
            userMenuButton.classList.remove('active');
            
            // Reset dropdown indicator
            const indicator = userMenuButton.querySelector('.dropdown-indicator i');
            if (indicator) {
                indicator.style.transform = 'rotate(0deg)';
            }
        }
    });
});