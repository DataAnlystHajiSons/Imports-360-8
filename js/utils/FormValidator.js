/**
 * FormValidator
 * Centralized validation logic for forms
 */
export class FormValidator {
  static validateShipmentForm(formData) {
    const errors = [];

    // Validate shipment type
    if (!formData.type || !['LC', 'DP'].includes(formData.type)) {
      errors.push('Please select a valid shipment type');
    }

    // Validate payment term
    if (!formData.payment_term_id) {
      errors.push('Please select a payment term');
    }

    // Validate mode of transport
    if (!formData.mode_of_transport) {
      errors.push('Please select a mode of transport');
    }

    const validModes = ['sea', 'air', 'land', 'rail', 'multimodal'];
    if (formData.mode_of_transport && !validModes.includes(formData.mode_of_transport)) {
      errors.push('Please select a valid mode of transport');
    }

    // Validate products
    if (!formData.products || formData.products.length === 0) {
      errors.push('Please add at least one product');
    }

    // Validate each product
    if (formData.products) {
      formData.products.forEach((product, index) => {
        if (!product.product_variety_id) {
          errors.push(`Product ${index + 1}: Please select a product variety`);
        }
        if (!product.quantity || parseFloat(product.quantity) <= 0) {
          errors.push(`Product ${index + 1}: Please enter a valid quantity`);
        }
        if (!product.unit) {
          errors.push(`Product ${index + 1}: Please select a unit`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static validateCommodityName(name) {
    const errors = [];

    if (!name || name.trim() === '') {
      errors.push('Commodity name is required');
    }

    if (name && name.length > 100) {
      errors.push('Commodity name must be less than 100 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  static sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input.trim();
  }
}
