/**
 * ShipmentFormManager
 * Orchestrates the entire Create Shipment modal
 */
import { ProductRow } from './ProductRow.js';
import { FormValidator } from '../utils/FormValidator.js';

export class ShipmentFormManager {
  constructor(supabaseClient, shipmentService, commodityService) {
    this.supabase = supabaseClient;
    this.shipmentService = shipmentService;
    this.commodityService = commodityService;
    
    this.modal = null;
    this.form = null;
    this.productContainer = null;
    this.messageDiv = null;
    this.addProductBtn = null;
    
    this.productRows = [];
    this.productVarieties = [];
    this.paymentTerms = [];
    
    this.isLoading = false;
    this.activeCommodityData = null; // For add commodity modal
    
    this.init();
  }

  async init() {
    this.getElements();
    this.attachEventListeners();
    await this.loadInitialData();
  }

  getElements() {
    this.modal = document.getElementById('create-shipment-modal');
    this.form = document.getElementById('create-shipment-form');
    this.productContainer = document.getElementById('product-list-container');
    this.messageDiv = document.getElementById('create-shipment-message');
    this.addProductBtn = document.getElementById('add-product-btn');
    
    // Add commodity modal elements
    this.addCommodityModal = document.getElementById('add-commodity-modal');
    this.addCommodityForm = document.getElementById('add-commodity-form');
    this.addCommodityMessage = document.getElementById('add-commodity-message');
  }

  attachEventListeners() {
    // Main form submit
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    // Add product button
    this.addProductBtn.addEventListener('click', () => this.addProductRow());
    
    // Close modal buttons
    document.getElementById('close-modal-btn').addEventListener('click', () => this.closeModal());
    document.getElementById('close-add-commodity-modal-btn').addEventListener('click', () => this.closeAddCommodityModal());
    
    // Add commodity form submit
    this.addCommodityForm.addEventListener('submit', (e) => this.handleAddCommodity(e));
  }

  async loadInitialData() {
    try {
      this.showLoading(true);
      
      // Load payment terms and product varieties in parallel
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

  addProductRow() {
    const productRow = new ProductRow(
      this.commodityService,
      this.productVarieties,
      (row) => this.removeProductRow(row),
      (selectElement) => this.openAddCommodityModal(selectElement)
    );
    
    this.productRows.push(productRow);
    this.productContainer.appendChild(productRow.getElement());
    
    // Scroll to new product row
    productRow.getElement().scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  removeProductRow(productRow) {
    const index = this.productRows.indexOf(productRow);
    if (index > -1) {
      this.productRows.splice(index, 1);
      productRow.destroy();
    }
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    if (this.isLoading) return;
    
    try {
      // Gather form data
      const formData = this.getFormData();
      
      // Validate
      const validation = FormValidator.validateShipmentForm(formData);
      if (!validation.isValid) {
        this.showMessage(validation.errors.join('<br>'), 'error');
        return;
      }
      
      this.showLoading(true);
      this.showMessage('Creating shipment...', 'info');
      
      // Get current user
      const { data: { user } } = await this.supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }
      
      // Generate reference code
      const referenceCode = await this.shipmentService.generateReferenceCode(formData.type);
      
      // Create shipment
      const shipment = await this.shipmentService.createShipment({
        reference_code: referenceCode,
        type: formData.type,
        payment_term_id: formData.payment_term_id,
        mode_of_transport: formData.mode_of_transport
      }, user.id);
      
      // Add products
      await this.shipmentService.addProductsToShipment(shipment.id, formData.products);
      
      // Success
      this.showMessage('Shipment created successfully!', 'success');
      
      // Reset form and close modal after delay
      setTimeout(() => {
        this.resetForm();
        this.closeModal();
        
        // Trigger refresh on parent page
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
    return {
      type: this.form.querySelector('[name="type"]').value,
      payment_term_id: this.form.querySelector('[name="payment_term_id"]').value,
      mode_of_transport: this.form.querySelector('[name="mode_of_transport"]').value,
      products: this.productRows.map(row => row.getData())
    };
  }

  openAddCommodityModal(selectElement) {
    // Store reference to the commodity select that triggered this
    const productRow = this.productRows.find(row => 
      row.commoditySelect === selectElement
    );
    
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
      
      // Validate
      const validation = FormValidator.validateCommodityName(commodityName);
      if (!validation.isValid) {
        this.showCommodityMessage(validation.errors.join('<br>'), 'error');
        return;
      }
      
      this.showCommodityMessage('Adding commodity...', 'info');
      
      // Add commodity
      const newCommodity = await this.commodityService.addCommodity(
        FormValidator.sanitizeInput(commodityName)
      );
      
      this.showCommodityMessage('Commodity added successfully!', 'success');
      
      // Update all product rows with new commodity
      await Promise.all(
        this.productRows.map(row => row.reloadCommodities())
      );
      
      // Select the newly added commodity in the active row
      if (this.activeCommodityData && this.activeCommodityData.productRow) {
        await this.activeCommodityData.productRow.selectCommodity(newCommodity.id);
      }
      
      // Close modal after delay
      setTimeout(() => {
        this.closeAddCommodityModal();
      }, 1000);
      
    } catch (error) {
      console.error('Failed to add commodity:', error);
      this.showCommodityMessage(`Error: ${error.message}`, 'error');
    }
  }

  showMessage(message, type = 'info') {
    const className = type === 'error' ? 'error-message' : 
                     type === 'success' ? 'success-message' : 
                     'warning-message';
    
    this.messageDiv.innerHTML = `<p class="${className}">${message}</p>`;
  }

  showCommodityMessage(message, type = 'info') {
    const className = type === 'error' ? 'error-message' : 
                     type === 'success' ? 'success-message' : 
                     'warning-message';
    
    this.addCommodityMessage.innerHTML = `<p class="${className}">${message}</p>`;
  }

  showLoading(isLoading) {
    this.isLoading = isLoading;
    const submitBtn = this.form.querySelector('[type="submit"]');
    
    if (isLoading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
      this.addProductBtn.disabled = true;
    } else {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Shipment';
      this.addProductBtn.disabled = false;
    }
  }

  resetForm() {
    this.form.reset();
    this.messageDiv.innerHTML = '';
    
    // Remove all product rows
    this.productRows.forEach(row => row.destroy());
    this.productRows = [];
    
    // Add initial product row
    this.addProductRow();
  }

  async openModal() {
    this.modal.style.display = 'block';
    this.resetForm();
    
    // Ensure data is loaded
    if (this.paymentTerms.length === 0 || this.productVarieties.length === 0) {
      await this.loadInitialData();
    }
    
    // Add initial product row if none exist
    if (this.productRows.length === 0) {
      this.addProductRow();
    }
  }

  closeModal() {
    this.modal.style.display = 'none';
    this.resetForm();
  }
}
