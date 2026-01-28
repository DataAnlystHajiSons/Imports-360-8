/**
 * ProductRow Component
 * Manages a single product entry in the shipment form
 */
import { SearchableDropdown } from './SearchableDropdown.js';

export class ProductRow {
  constructor(commodityService, productVarieties, onRemove, onAddCommodity) {
    this.commodityService = commodityService;
    this.productVarieties = productVarieties;
    this.onRemove = onRemove;
    this.onAddCommodity = onAddCommodity;
    
    this.element = null;
    this.commodityDropdown = null;
    this.varietyDropdown = null;
    this.unitDropdown = null;
    
    this.commoditySelect = null;
    this.varietySelect = null;
    this.unitSelect = null;
    this.quantityInput = null;
    
    this.init();
  }

  init() {
    this.createElement();
    this.attachEventListeners();
    this.loadCommodities();
  }

  createElement() {
    this.element = document.createElement('div');
    this.element.classList.add('product-form-item');

    this.element.innerHTML = `
      <div class="form-row">
        <div class="form-field">
          <label>Commodity: <span class="required">*</span></label>
          <div class="input-group">
            <select name="commodity" required></select>
            <button type="button" class="add-new-btn" title="Add New Commodity">
              <i class="fas fa-plus"></i>
            </button>
          </div>
        </div>
        <div class="form-field">
          <label>Product Variety: <span class="required">*</span></label>
          <select name="product_variety_id" required disabled>
            <option value="">Select a commodity first</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-field">
          <label>Quantity: <span class="required">*</span></label>
          <input type="number" name="quantity" required min="0" step="any" placeholder="Enter quantity">
        </div>
        <div class="form-field">
          <label>Unit: <span class="required">*</span></label>
          <select name="unit" required>
            <option value="">Select a commodity first</option>
          </select>
        </div>
      </div>
      <button type="button" class="remove-product-btn button-secondary">
        <i class="fas fa-trash-alt"></i>
        <span>Remove Product</span>
      </button>
      <hr class="product-divider">
    `;

    // Get references to elements
    this.commoditySelect = this.element.querySelector('[name="commodity"]');
    this.varietySelect = this.element.querySelector('[name="product_variety_id"]');
    this.unitSelect = this.element.querySelector('[name="unit"]');
    this.quantityInput = this.element.querySelector('[name="quantity"]');
  }

  attachEventListeners() {
    // Add new commodity button
    const addNewBtn = this.element.querySelector('.add-new-btn');
    addNewBtn.addEventListener('click', () => {
      this.onAddCommodity(this.commoditySelect);
    });

    // Commodity change
    this.commoditySelect.addEventListener('change', async () => {
      await this.handleCommodityChange();
    });

    // Remove button
    const removeBtn = this.element.querySelector('.remove-product-btn');
    removeBtn.addEventListener('click', () => {
      this.onRemove(this);
    });
  }

  async loadCommodities() {
    try {
      const commodities = await this.commodityService.getCommodities();
      
      this.commoditySelect.innerHTML = '';
      const options = [
        { value: '', text: 'Select a commodity' },
        ...commodities.map(c => ({ value: c.id, text: c.name }))
      ];

      // Add options to select
      options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        this.commoditySelect.appendChild(optionElement);
      });

      // Create searchable dropdown
      this.commodityDropdown = new SearchableDropdown(
        this.commoditySelect,
        options,
        'Search commodities...'
      );
    } catch (error) {
      console.error('Failed to load commodities:', error);
      this.showError('Failed to load commodities');
    }
  }

  async handleCommodityChange() {
    const selectedCommodityId = this.commoditySelect.value;

    if (!selectedCommodityId) {
      this.resetVarietyAndUnit();
      return;
    }

    // Filter product varieties for selected commodity
    const filteredVarieties = this.productVarieties.filter(
      p => p.commodity_id === selectedCommodityId
    );

    // Update variety dropdown - ENABLE IT
    this.varietySelect.disabled = false;
    this.varietySelect.innerHTML = '';
    
    // Remove disabled visual feedback
    const varietyField = this.varietySelect.closest('.form-field');
    if (varietyField) {
      varietyField.style.opacity = '1';
      varietyField.style.pointerEvents = 'auto';
    }

    const varietyOptions = [
      { value: '', text: 'Select a product variety' },
      ...filteredVarieties.map(item => ({
        value: item.id,
        text: `${item.product_name} - ${item.variety_name}`
      }))
    ];

    varietyOptions.forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.text;
      this.varietySelect.appendChild(optionElement);
    });

    // Destroy existing variety dropdown if present
    if (this.varietyDropdown) {
      this.varietyDropdown.destroy();
    }

    this.varietyDropdown = new SearchableDropdown(
      this.varietySelect,
      varietyOptions,
      'Search product varieties...'
    );

    // Load units for selected commodity
    await this.loadUnits(selectedCommodityId);
  }

  async loadUnits(commodityId) {
    try {
      const units = await this.commodityService.getMeasurementUnits(commodityId);
      
      this.unitSelect.innerHTML = '';
      this.unitSelect.disabled = false;
      
      // Remove disabled visual feedback
      const unitField = this.unitSelect.closest('.form-field');
      if (unitField) {
        unitField.style.opacity = '1';
        unitField.style.pointerEvents = 'auto';
      }
      
      const unitOptions = [
        { value: '', text: 'Select a unit' },
        ...units.map(unit => ({
          value: unit.unit_name,
          text: unit.unit_name
        }))
      ];

      unitOptions.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.text;
        this.unitSelect.appendChild(optionElement);
      });

      // Destroy existing unit dropdown if present
      if (this.unitDropdown) {
        this.unitDropdown.destroy();
      }

      this.unitDropdown = new SearchableDropdown(
        this.unitSelect,
        unitOptions,
        'Search units...'
      );
    } catch (error) {
      console.error('Failed to load units:', error);
      this.showError('Failed to load measurement units');
    }
  }

  resetVarietyAndUnit() {
    this.varietySelect.disabled = true;
    this.varietySelect.innerHTML = '<option value="">Select a commodity first</option>';
    
    // Add visual feedback for disabled state
    const varietyField = this.varietySelect.closest('.form-field');
    if (varietyField) {
      varietyField.style.opacity = '0.6';
      varietyField.style.pointerEvents = 'none';
    }
    
    // Destroy dropdowns
    if (this.varietyDropdown) {
      this.varietyDropdown.destroy();
      this.varietyDropdown = null;
    }
    
    if (this.unitDropdown) {
      this.unitDropdown.destroy();
      this.unitDropdown = null;
    }

    this.unitSelect.innerHTML = '<option value="">Select a commodity first</option>';
    this.unitSelect.disabled = true;
    
    // Add visual feedback for disabled unit
    const unitField = this.unitSelect.closest('.form-field');
    if (unitField) {
      unitField.style.opacity = '0.6';
      unitField.style.pointerEvents = 'none';
    }
  }

  showError(message) {
    // You can implement a toast notification here
    console.error(message);
  }

  getData() {
    const data = {
      commodity_id: this.commoditySelect.value,
      product_variety_id: this.varietySelect.value,
      quantity: this.quantityInput.value,
      unit: this.unitSelect.value
    };
    console.log('ProductRow.getData():', data);
    return data;
  }

  isValid() {
    const data = this.getData();
    const valid = data.commodity_id && data.product_variety_id && data.quantity && data.unit;
    console.log('ProductRow.isValid():', valid, data);
    return valid;
  }

  async reloadCommodities() {
    await this.loadCommodities();
  }

  async selectCommodity(commodityId) {
    if (this.commodityDropdown) {
      this.commodityDropdown.setValue(commodityId);
      await this.handleCommodityChange();
    }
  }

  destroy() {
    if (this.commodityDropdown) this.commodityDropdown.destroy();
    if (this.varietyDropdown) this.varietyDropdown.destroy();
    if (this.unitDropdown) this.unitDropdown.destroy();
    this.element.remove();
  }

  highlightError(fieldName) {
    let field = null;
    switch(fieldName) {
      case 'commodity':
        field = this.commoditySelect.closest('.form-field');
        break;
      case 'variety':
        field = this.varietySelect.closest('.form-field');
        break;
      case 'quantity':
        field = this.quantityInput.closest('.form-field');
        break;
      case 'unit':
        field = this.unitSelect.closest('.form-field');
        break;
    }
    
    if (field) {
      field.style.borderLeft = '3px solid var(--error-color)';
      field.style.backgroundColor = 'rgba(220, 38, 38, 0.05)';
    }
  }

  clearErrors() {
    const fields = this.element.querySelectorAll('.form-field');
    fields.forEach(field => {
      field.style.borderLeft = '';
      field.style.backgroundColor = '';
    });
  }

  getElement() {
    return this.element;
  }
}
