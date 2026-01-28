/**
 * ShipmentFormManager v2.0 - With Multi-Step Wizard & Review
 * Orchestrates the entire Create Shipment modal with 3 steps
 */
import { ProductRow } from './ProductRow.js';
import { FormValidator } from '../utils/FormValidator.js';

// Inco-term options based on mode of transport
const INCOTERM_OPTIONS = {
  air: [
    { value: 'FCA', label: 'FCA (Free Carrier)' },
    { value: 'EXW', label: 'EXW (Ex Works)' },
    { value: 'CPT', label: 'CPT (Carriage Paid To)' }
  ],
  sea: [
    { value: 'EXW', label: 'EXW (Ex Works)' },
    { value: 'FOB', label: 'FOB (Free On Board)' },
    { value: 'CFR', label: 'CFR (Cost and Freight)' }
  ],
  land: [
    { value: 'FCA', label: 'FCA (Free Carrier)' },
    { value: 'EXW', label: 'EXW (Ex Works)' },
    { value: 'CPT', label: 'CPT (Carriage Paid To)' }
  ],
  rail: [
    { value: 'FCA', label: 'FCA (Free Carrier)' },
    { value: 'EXW', label: 'EXW (Ex Works)' },
    { value: 'CPT', label: 'CPT (Carriage Paid To)' }
  ],
  multimodal: [
    { value: 'FCA', label: 'FCA (Free Carrier)' },
    { value: 'EXW', label: 'EXW (Ex Works)' },
    { value: 'CPT', label: 'CPT (Carriage Paid To)' },
    { value: 'DDP', label: 'DDP (Delivered Duty Paid)' }
  ]
};

export class ShipmentFormManager {
  constructor(supabaseClient, shipmentService, commodityService) {
    this.supabase = supabaseClient;
    this.shipmentService = shipmentService;
    this.commodityService = commodityService;
    
    // Modal elements
    this.modal = null;
    this.form = null;
    this.productContainer = null;
    this.messageDiv = null;
    this.addProductBtn = null;
    
    // Wizard elements
    this.currentStep = 1;
    this.wizardSteps = [];
    this.formSteps = [];
    this.nextBtn = null;
    this.backBtn = null;
    this.submitBtn = null;
    this.cancelBtn = null;
    
    // Data
    this.productRows = [];
    this.productVarieties = [];
    this.paymentTerms = [];
    
    // State
    this.isLoading = false;
    this.activeCommodityData = null;
    
    this.init();
  }

  async init() {
    this.getElements();
    this.attachEventListeners();
    await this.loadInitialData();
  }

  getElements() {
    // Modal
    this.modal = document.getElementById('create-shipment-modal');
    this.form = document.getElementById('create-shipment-form');
    this.productContainer = document.getElementById('product-list-container');
    this.messageDiv = document.getElementById('create-shipment-message');
    this.addProductBtn = document.getElementById('add-product-btn');
    
    // Wizard
    this.wizardSteps = Array.from(document.querySelectorAll('.wizard-step'));
    this.formSteps = Array.from(document.querySelectorAll('.form-step'));
    this.nextBtn = document.getElementById('wizard-next-btn');
    this.backBtn = document.getElementById('wizard-back-btn');
    this.submitBtn = document.getElementById('wizard-submit-btn');
    this.cancelBtn = document.getElementById('wizard-cancel-btn');
    
    // Add commodity modal
    this.addCommodityModal = document.getElementById('add-commodity-modal');
    this.addCommodityForm = document.getElementById('add-commodity-form');
    this.addCommodityMessage = document.getElementById('add-commodity-message');
    
    // Debug: Log what we found
    console.log('Elements initialized:');
    console.log('- Modal:', !!this.modal);
    console.log('- Form:', !!this.form);
    console.log('- Next button:', !!this.nextBtn);
    console.log('- Back button:', !!this.backBtn);
    console.log('- Submit button:', !!this.submitBtn);
    console.log('- Wizard steps:', this.wizardSteps.length);
    console.log('- Form steps:', this.formSteps.length);
  }

  attachEventListeners() {
    // Check if elements exist before attaching listeners
    if (!this.nextBtn || !this.backBtn || !this.cancelBtn) {
      console.error('Wizard buttons not found! Check HTML structure.');
      return;
    }
    
    // Wizard navigation
    this.nextBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('Next button clicked, current step:', this.currentStep);
      this.goToNextStep();
    });
    
    this.backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.goToPreviousStep();
    });
    
    this.cancelBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.closeModal();
    });
    
    // Form submit
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Product management
    this.addProductBtn.addEventListener('click', () => this.addProductRow());
    
    // Modal close buttons
    const closeBtn = document.getElementById('close-modal-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeModal());
    }
    
    const closeCommodityBtn = document.getElementById('close-add-commodity-modal-btn');
    if (closeCommodityBtn) {
      closeCommodityBtn.addEventListener('click', () => this.closeAddCommodityModal());
    }
    
    // Edit buttons in review section
    document.querySelectorAll('.edit-section-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const targetStep = parseInt(e.currentTarget.dataset.gotoStep);
        this.goToStep(targetStep);
      });
    });
    
    // Add commodity form
    if (this.addCommodityForm) {
      this.addCommodityForm.addEventListener('submit', (e) => this.handleAddCommodity(e));
    }
    
    // Setup inco-term dynamic logic
    this.setupIncotermLogic();
    
    console.log('All event listeners attached successfully');
  }

  async loadInitialData() {
    try {
      this.showLoading(true);
      
      [this.paymentTerms, this.productVarieties] = await Promise.all([
        this.shipmentService.getPaymentTerms(),
        this.shipmentService.getProductVarieties()
      ]);
      
      this.populatePaymentTerms();
      this.showLoading(false);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showMessage('Failed to load form data. Please try again.', 'error');
      this.showLoading(false);
    }
  }

  populatePaymentTerms() {
    const select = this.form.querySelector('[name="payment_term_id"]');
    select.innerHTML = '';
    
    if (this.paymentTerms.length === 0) {
      select.innerHTML = '<option value="">No payment terms available</option>';
      return;
    }
    
    select.innerHTML = '<option value="">Select a payment term</option>';
    this.paymentTerms.forEach(term => {
      const option = document.createElement('option');
      option.value = term.id;
      option.textContent = term.name;
      select.appendChild(option);
    });
  }

  // ===================================
  // Wizard Navigation
  // ===================================

  goToNextStep() {
    console.log('goToNextStep called, current step:', this.currentStep);
    
    // Validate current step before proceeding
    const isValid = this.validateCurrentStep();
    console.log('Validation result:', isValid);
    
    if (!isValid) {
      console.log('Validation failed, not proceeding');
      return;
    }
    
    console.log('Validation passed, moving to next step');
    
    if (this.currentStep < 3) {
      this.goToStep(this.currentStep + 1);
    }
  }

  goToPreviousStep() {
    if (this.currentStep > 1) {
      this.goToStep(this.currentStep - 1);
    }
  }

  goToStep(stepNumber) {
    // Clear any messages
    this.messageDiv.innerHTML = '';
    
    // Update step tracking
    this.currentStep = stepNumber;
    
    // Update wizard step indicators
    this.wizardSteps.forEach((step, index) => {
      const stepNum = index + 1;
      step.classList.remove('active', 'completed');
      
      if (stepNum === stepNumber) {
        step.classList.add('active');
      } else if (stepNum < stepNumber) {
        step.classList.add('completed');
      }
    });
    
    // Show/hide form steps
    this.formSteps.forEach((step, index) => {
      if (index + 1 === stepNumber) {
        step.style.display = 'block';
      } else {
        step.style.display = 'none';
      }
    });
    
    // Update navigation buttons
    this.updateNavigationButtons();
    
    // If going to review step, populate review
    if (stepNumber === 3) {
      this.populateReview();
    }
  }

  updateNavigationButtons() {
    // Back button
    if (this.currentStep === 1) {
      this.backBtn.style.display = 'none';
    } else {
      this.backBtn.style.display = 'flex';
    }
    
    // Next/Submit buttons
    if (this.currentStep === 3) {
      this.nextBtn.style.display = 'none';
      this.submitBtn.style.display = 'flex';
    } else {
      this.nextBtn.style.display = 'flex';
      this.submitBtn.style.display = 'none';
    }
  }

  validateCurrentStep() {
    console.log('validateCurrentStep called for step:', this.currentStep);
    console.log('Number of product rows:', this.productRows.length);
    
    if (this.currentStep === 1) {
      // Validate products
      if (this.productRows.length === 0) {
        console.log('No products added');
        this.showMessage('⚠️ Please add at least one product to continue', 'error');
        return false;
      }
      
      // Detailed validation for each product
      const errors = [];
      this.productRows.forEach((row, index) => {
        const data = row.getData();
        const productNum = index + 1;
        
        console.log(`Product ${productNum} data:`, data);
        
        if (!data.commodity_id) {
          errors.push(`Product ${productNum}: Please select a commodity`);
          row.highlightError('commodity');
        }
        if (!data.product_variety_id) {
          errors.push(`Product ${productNum}: Please select a product variety`);
          row.highlightError('variety');
        }
        if (!data.quantity || parseFloat(data.quantity) <= 0) {
          errors.push(`Product ${productNum}: Please enter a valid quantity`);
          row.highlightError('quantity');
        }
        if (!data.unit) {
          errors.push(`Product ${productNum}: Please select a unit`);
          row.highlightError('unit');
        }
      });
      
      if (errors.length > 0) {
        console.log('Validation errors:', errors);
        this.showMessage('⚠️ Please complete the following:<br>' + errors.join('<br>'), 'error');
        return false;
      }
      
      console.log('All products valid, clearing errors');
      // Clear any highlights if all valid
      this.productRows.forEach(row => row.clearErrors());
      
    } else if (this.currentStep === 2) {
      // Validate shipment details
      const type = this.form.querySelector('[name="type"]').value;
      const modeOfTransport = this.form.querySelector('[name="mode_of_transport"]').value;
      const incoTerm = this.form.querySelector('[name="inco_term"]').value;
      const freightCharges = this.form.querySelector('[name="freight_charges"]')?.value;
      const paymentTermId = this.form.querySelector('[name="payment_term_id"]').value;
      
      console.log('Step 2 validation:', { type, modeOfTransport, incoTerm, freightCharges, paymentTermId });
      
      const errors = [];
      if (!type) errors.push('Please select a Shipment Type');
      if (!modeOfTransport) errors.push('Please select a Mode of Transport');
      if (!incoTerm) errors.push('Please select an Inco-term');
      
      // Validate freight charges if FOB
      if (incoTerm === 'FOB') {
        if (!freightCharges || parseFloat(freightCharges) <= 0) {
          errors.push('Please enter valid FOB Charges (required for FOB inco-term)');
        }
      }
      
      if (!paymentTermId) errors.push('Please select a Payment Term');
      
      if (errors.length > 0) {
        console.log('Step 2 errors:', errors);
        this.showMessage('⚠️ Please complete the following:<br>' + errors.join('<br>'), 'error');
        return false;
      }
    }
    
    console.log('Validation passed for step', this.currentStep);
    return true;
  }

  // ===================================
  // Review Section
  // ===================================

  populateReview() {
    this.populateProductsReview();
    this.populateDetailsReview();
  }

  populateProductsReview() {
    const container = document.getElementById('review-products');
    
    if (this.productRows.length === 0) {
      container.innerHTML = '<p style="color: var(--text-secondary-color);">No products added</p>';
      return;
    }
    
    let html = '<table class="review-products-table"><thead><tr>';
    html += '<th>Product</th>';
    html += '<th>Variety</th>';
    html += '<th>Quantity</th>';
    html += '<th>Unit</th>';
    html += '</tr></thead><tbody>';
    
    this.productRows.forEach(row => {
      const data = row.getData();
      
      // Get readable names
      const commodity = this.getCommodityName(data.commodity_id);
      const variety = this.getVarietyName(data.product_variety_id);
      
      html += '<tr>';
      html += `<td class="product-name-cell">${commodity}</td>`;
      html += `<td>${variety}</td>`;
      html += `<td>${data.quantity}</td>`;
      html += `<td>${data.unit}</td>`;
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  populateDetailsReview() {
    const container = document.getElementById('review-details');
    
    const type = this.form.querySelector('[name="type"]').value;
    const modeOfTransport = this.form.querySelector('[name="mode_of_transport"]').value;
    const incoTerm = this.form.querySelector('[name="inco_term"]').value;
    const freightCharges = this.form.querySelector('[name="freight_charges"]')?.value;
    const paymentTermId = this.form.querySelector('[name="payment_term_id"]').value;
    
    const typeLabel = type === 'LC' ? 'LC (Letter of Credit)' : 'DP (Documents against Payment)';
    const modeLabel = this.getModeOfTransportLabel(modeOfTransport);
    const incoTermLabel = this.getIncotermLabel(incoTerm);
    const paymentTermLabel = this.getPaymentTermName(paymentTermId);
    
    let html = '';
    html += `<div class="review-item"><span class="review-item-label">Shipment Type:</span><span class="review-item-value">${typeLabel}</span></div>`;
    html += `<div class="review-item"><span class="review-item-label">Mode of Transport:</span><span class="review-item-value">${modeLabel}</span></div>`;
    html += `<div class="review-item"><span class="review-item-label">Inco-term:</span><span class="review-item-value">${incoTermLabel}</span></div>`;
    
    // Show freight charges only if FOB
    if (incoTerm === 'FOB' && freightCharges) {
      html += `<div class="review-item"><span class="review-item-label">FOB Charges:</span><span class="review-item-value">$${parseFloat(freightCharges).toFixed(2)} USD</span></div>`;
    }
    
    html += `<div class="review-item"><span class="review-item-label">Payment Term:</span><span class="review-item-value">${paymentTermLabel}</span></div>`;
    
    container.innerHTML = html;
  }

  // Helper functions for review
  getCommodityName(commodityId) {
    // Get from the first product row's dropdown or fallback to "Unknown"
    const select = document.querySelector(`[name="commodity"][value="${commodityId}"]`);
    if (select) {
      return select.parentElement.querySelector(`option[value="${commodityId}"]`)?.text || 'Unknown';
    }
    
    // Fallback: search all commodity selects
    const allSelects = document.querySelectorAll('[name="commodity"]');
    for (const sel of allSelects) {
      const option = sel.querySelector(`option[value="${commodityId}"]`);
      if (option) return option.text;
    }
    
    return 'Unknown';
  }

  getVarietyName(varietyId) {
    const variety = this.productVarieties.find(v => v.id === varietyId);
    return variety ? `${variety.product_name} - ${variety.variety_name}` : 'Unknown';
  }

  getModeOfTransportLabel(mode) {
    const labels = {
      'sea': 'Sea Freight',
      'air': 'Air Freight',
      'land': 'Land Transport',
      'rail': 'Rail Transport',
      'multimodal': 'Multimodal Transport'
    };
    return labels[mode] || mode;
  }

  getPaymentTermName(paymentTermId) {
    const term = this.paymentTerms.find(t => t.id === paymentTermId);
    return term ? term.name : 'Unknown';
  }

  // ===================================
  // Product Management
  // ===================================

  addProductRow() {
    const productRow = new ProductRow(
      this.commodityService,
      this.productVarieties,
      (row) => this.removeProductRow(row),
      (selectElement) => this.openAddCommodityModal(selectElement)
    );
    
    this.productRows.push(productRow);
    this.productContainer.appendChild(productRow.getElement());
    
    productRow.getElement().scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  removeProductRow(productRow) {
    const index = this.productRows.indexOf(productRow);
    if (index > -1) {
      this.productRows.splice(index, 1);
      productRow.destroy();
    }
  }

  // ===================================
  // Form Submission
  // ===================================

  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isLoading) return;
    
    try {
      const formData = this.getFormData();
      
      // Final validation
      const validation = FormValidator.validateShipmentForm(formData);
      if (!validation.isValid) {
        this.showMessage(validation.errors.join('<br>'), 'error');
        return;
      }
      
      this.showLoading(true);
      this.showMessage('Creating shipment...', 'info');
      
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      const referenceCode = await this.shipmentService.generateReferenceCode(formData.type);
      
      const shipment = await this.shipmentService.createShipment({
        reference_code: referenceCode,
        type: formData.type,
        payment_term_id: formData.payment_term_id,
        mode_of_transport: formData.mode_of_transport,
        inco_term: formData.inco_term,
        freight_charges: formData.freight_charges
      }, user.id);
      
      await this.shipmentService.addProductsToShipment(shipment.id, formData.products);
      
      this.showMessage('Shipment created successfully!', 'success');
      
      setTimeout(() => {
        this.resetForm();
        this.closeModal();
        
        if (window.loadShipments) window.loadShipments();
        if (window.loadDashboardStats) window.loadDashboardStats();
      }, 1500);
      
    } catch (error) {
      console.error('Failed to create shipment:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  getFormData() {
    const freightChargesValue = this.form.querySelector('[name="freight_charges"]')?.value;
    return {
      type: this.form.querySelector('[name="type"]').value,
      payment_term_id: this.form.querySelector('[name="payment_term_id"]').value,
      mode_of_transport: this.form.querySelector('[name="mode_of_transport"]').value,
      inco_term: this.form.querySelector('[name="inco_term"]').value,
      freight_charges: freightChargesValue ? parseFloat(freightChargesValue) : null,
      products: this.productRows.map(row => row.getData())
    };
  }

  // ===================================
  // Commodity Management
  // ===================================

  openAddCommodityModal(selectElement) {
    const productRow = this.productRows.find(row => row.commoditySelect === selectElement);
    
    this.activeCommodityData = {
      selectElement,
      productRow
    };
    
    this.addCommodityModal.style.display = 'block';
    this.addCommodityForm.reset();
    this.addCommodityMessage.innerHTML = '';
  }

  closeAddCommodityModal() {
    this.addCommodityModal.style.display = 'none';
    this.activeCommodityData = null;
  }

  async handleAddCommodity(e) {
    e.preventDefault();
    
    try {
      const commodityName = document.getElementById('new_commodity_name').value;
      
      const validation = FormValidator.validateCommodityName(commodityName);
      if (!validation.isValid) {
        this.showCommodityMessage(validation.errors.join('<br>'), 'error');
        return;
      }
      
      this.showCommodityMessage('Adding commodity...', 'info');
      
      const newCommodity = await this.commodityService.addCommodity(
        FormValidator.sanitizeInput(commodityName)
      );
      
      this.showCommodityMessage('Commodity added successfully!', 'success');
      
      await Promise.all(this.productRows.map(row => row.reloadCommodities()));
      
      if (this.activeCommodityData && this.activeCommodityData.productRow) {
        await this.activeCommodityData.productRow.selectCommodity(newCommodity.id);
      }
      
      setTimeout(() => {
        this.closeAddCommodityModal();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to add commodity:', error);
      this.showCommodityMessage(`Error: ${error.message}`, 'error');
    }
  }

  // ===================================
  // UI Helpers
  // ===================================

  showMessage(message, type = 'info') {
    const className = type === 'error' ? 'error-message' : 
                     type === 'success' ? 'success-message' : 
                     'warning-message';
    
    this.messageDiv.innerHTML = `<p class="${className}">${message}</p>`;
    
    // Scroll message into view
    this.messageDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  showCommodityMessage(message, type = 'info') {
    const className = type === 'error' ? 'error-message' : 
                     type === 'success' ? 'success-message' : 
                     'warning-message';
    
    this.addCommodityMessage.innerHTML = `<p class="${className}">${message}</p>`;
  }

  showLoading(isLoading) {
    this.isLoading = isLoading;
    
    if (isLoading) {
      this.submitBtn.disabled = true;
      this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
      this.nextBtn.disabled = true;
      this.addProductBtn.disabled = true;
    } else {
      this.submitBtn.disabled = false;
      this.submitBtn.innerHTML = '<i class="fas fa-check"></i><span>Create Shipment</span>';
      this.nextBtn.disabled = false;
      this.addProductBtn.disabled = false;
    }
  }

  resetForm() {
    this.form.reset();
    this.messageDiv.innerHTML = '';
    
    this.productRows.forEach(row => row.destroy());
    this.productRows = [];
    
    this.currentStep = 1;
    this.goToStep(1);
  }

  async openModal() {
    this.modal.style.display = 'block';
    this.resetForm();
    
    if (this.paymentTerms.length === 0 || this.productVarieties.length === 0) {
      await this.loadInitialData();
    }
    
    if (this.productRows.length === 0) {
      this.addProductRow();
    }
    
    this.goToStep(1);
  }

  closeModal() {
    this.modal.style.display = 'none';
    this.resetForm();
  }
  
  // ===================================
  // Inco-term Management Methods
  // ===================================
  
  setupIncotermLogic() {
    const modeSelect = this.form.querySelector('[name="mode_of_transport"]');
    const incotermSelect = this.form.querySelector('[name="inco_term"]');
    
    if (!modeSelect || !incotermSelect) {
      console.warn('Mode of transport or inco-term select not found');
      return;
    }
    
    // Listen for mode of transport changes
    modeSelect.addEventListener('change', () => {
      this.updateIncotermOptions();
      incotermSelect.value = '';
      this.toggleFreightChargesField();
    });
    
    // Listen for inco-term changes
    incotermSelect.addEventListener('change', () => {
      this.toggleFreightChargesField();
    });
    
    // Initial update
    this.updateIncotermOptions();
    this.toggleFreightChargesField();
  }
  
  updateIncotermOptions() {
    const modeSelect = this.form.querySelector('[name="mode_of_transport"]');
    const incotermSelect = this.form.querySelector('[name="inco_term"]');
    const incotermHint = document.getElementById('incoterm-hint');
    
    if (!modeSelect || !incotermSelect) return;
    
    const modeOfTransport = modeSelect.value;
    
    // Clear existing options
    incotermSelect.innerHTML = '';
    
    if (!modeOfTransport) {
      incotermSelect.innerHTML = '<option value="">Select mode of transport first</option>';
      incotermSelect.disabled = true;
      if (incotermHint) {
        incotermHint.textContent = 'Select mode of transport to see available inco-terms';
      }
      return;
    }
    
    // Get options for selected mode
    const options = INCOTERM_OPTIONS[modeOfTransport] || [];
    
    if (options.length === 0) {
      incotermSelect.innerHTML = '<option value="">No inco-terms available</option>';
      incotermSelect.disabled = true;
      return;
    }
    
    // Add placeholder
    incotermSelect.innerHTML = '<option value="">Select inco-term</option>';
    
    // Add options
    options.forEach(opt => {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      incotermSelect.appendChild(option);
    });
    
    // Enable the select
    incotermSelect.disabled = false;
    
    // Update hint
    if (incotermHint) {
      const modeLabel = {
        'air': 'Air Freight',
        'sea': 'Sea Freight',
        'land': 'Land Transport',
        'rail': 'Rail Transport',
        'multimodal': 'Multimodal'
      }[modeOfTransport] || 'selected mode';
      
      incotermHint.textContent = `Available inco-terms for ${modeLabel}`;
    }
  }
  
  toggleFreightChargesField() {
    const incotermSelect = this.form.querySelector('[name="inco_term"]');
    const freightChargesField = document.getElementById('freight-charges-field');
    const freightChargesInput = this.form.querySelector('[name="freight_charges"]');
    
    if (!incotermSelect || !freightChargesField || !freightChargesInput) return;
    
    const incotermValue = incotermSelect.value;
    
    if (incotermValue === 'FOB') {
      freightChargesField.style.display = 'block';
      freightChargesInput.required = true;
    } else {
      freightChargesField.style.display = 'none';
      freightChargesInput.required = false;
      freightChargesInput.value = '';
    }
  }
  
  getModeOfTransportLabel(mode) {
    const labels = {
      'sea': 'Sea Freight',
      'air': 'Air Freight',
      'land': 'Land Transport',
      'rail': 'Rail Transport',
      'multimodal': 'Multimodal Transport'
    };
    return labels[mode] || mode;
  }
  
  getIncotermLabel(incoterm) {
    const labels = {
      'EXW': 'EXW (Ex Works)',
      'FOB': 'FOB (Free On Board)',
      'CFR': 'CFR (Cost and Freight)',
      'FCA': 'FCA (Free Carrier)',
      'CPT': 'CPT (Carriage Paid To)',
      'DDP': 'DDP (Delivered Duty Paid)'
    };
    return labels[incoterm] || incoterm;
  }
}
