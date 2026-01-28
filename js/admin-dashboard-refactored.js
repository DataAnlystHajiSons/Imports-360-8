/**
 * Admin Dashboard - Refactored with Component Architecture
 * Main orchestration file using modular components
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { ShipmentFormManager } from './components/ShipmentFormManager.js';
import { ShipmentService } from './services/ShipmentService.js';
import { CommodityService } from './services/CommodityService.js';

// Initialize Supabase
const supabase = createClient(
  "https://sfknzqkiqxivzcualcau.supabase.co", 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNma256cWtpcXhpdnpjdWFsY2F1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY3OTU0ODksImV4cCI6MjA3MjM3MTQ4OX0.JKjOS9NRdbVH1UanfqmBeHmMSnlWlZtDr-5LdKw5YaA"
);

// Initialize Services
const shipmentService = new ShipmentService(supabase);
const commodityService = new CommodityService(supabase);

// Initialize Form Manager (will be initialized on window.onload)
let shipmentFormManager = null;

// Export functions for global access
window.logout = logout;
window.loadShipments = loadShipments;
window.loadDashboardStats = loadDashboardStats;

// ===================================
// Dashboard Stats
// ===================================

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

// ===================================
// Utility Functions
// ===================================

function toProperCase(str) {
  if (!str) return '';
  return str.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
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

// ===================================
// Stage & Status Badge Functions
// ===================================

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

// ===================================
// Shipments Table
// ===================================

async function loadShipments(searchTerm = '', filters = {}) {
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
    p_variety_name: filters.variety_name
  });

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

  // Add click handlers for expandable product rows
  tableBody.querySelectorAll('.enhanced-product-cell').forEach(cell => {
    cell.addEventListener('click', (e) => {
      const row = e.target.closest('.enhanced-row');
      const shipmentId = row.dataset.shipmentId;
      const subRows = tableBody.querySelectorAll(`.enhanced-sub-row[data-parent-shipment="${shipmentId}"]`);
      const productBadge = cell.querySelector('.product-badge');
      
      subRows.forEach(subRow => {
        subRow.classList.toggle('show');
      });
      
      cell.classList.toggle('expanded');
      
      if (productBadge) {
        productBadge.classList.toggle('expanded');
      }
    });
  });
}

// NOTE: The remaining code (filters, table sorting, insights, sidebar, etc.) 
// remains the same as the original file. Import from the original file or keep here.
// For brevity, I'm focusing on the modal refactoring.

// Export the supabase client for use in other modules if needed
export { supabase, shipmentService, commodityService };
