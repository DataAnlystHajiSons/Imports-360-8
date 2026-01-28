/**
 * ProductManager Component
 * Manages products for an existing shipment with full audit tracking
 */
export class ProductManager {
  constructor(supabaseClient, commodityService) {
    this.supabase = supabaseClient;
    this.commodityService = commodityService;
    this.shipmentId = null;
    this.products = [];
    this.productVarieties = [];
    this.currentUser = null;
  }

  /**
   * Initialize the product manager for a shipment
   */
  async initialize(shipmentId) {
    this.shipmentId = shipmentId;
    
    // Get current user
    const { data: { user } } = await this.supabase.auth.getUser();
    this.currentUser = user;

    // Load product varieties
    await this.loadProductVarieties();
    
    // Load current products
    await this.loadShipmentProducts();
  }

  /**
   * Load all product varieties
   */
  async loadProductVarieties() {
    try {
      const { data, error } = await this.supabase
        .from('product_variety')
        .select(`
          id,
          product_name,
          variety_name,
          commodity_id,
          rate_per_unit,
          unit,
          commodity:commodity_id (
            id,
            name
          )
        `)
        .order('product_name', { ascending: true });

      if (error) throw error;
      this.productVarieties = data || [];
    } catch (err) {
      console.error('Error loading product varieties:', err);
      throw err;
    }
  }

  /**
   * Load current products for the shipment
   */
  async loadShipmentProducts() {
    try {
      const { data, error } = await this.supabase
        .from('shipment_products')
        .select(`
          product_variety_id,
          quantity,
          unit,
          rate,
          amount,
          product_variety:product_variety_id (
            id,
            product_name,
            variety_name,
            commodity_id,
            commodity:commodity_id (
              name
            )
          )
        `)
        .eq('shipment_id', this.shipmentId);

      if (error) throw error;
      this.products = data || [];
      return this.products;
    } catch (err) {
      console.error('Error loading shipment products:', err);
      throw err;
    }
  }

  /**
   * Add a new product to the shipment
   */
  async addProduct(productVarietyId, quantity, unit, rate = null, amount = null, reason = null) {
    try {
      // Call the database function
      const { data, error } = await this.supabase.rpc('add_product_to_shipment', {
        p_shipment_id: this.shipmentId,
        p_product_variety_id: productVarietyId,
        p_quantity: quantity,
        p_unit: unit,
        p_rate: rate,
        p_amount: amount,
        p_reason: reason
      });

      if (error) throw error;

      // Reload products
      await this.loadShipmentProducts();

      return {
        success: true,
        message: 'Product added successfully'
      };
    } catch (err) {
      console.error('Error adding product:', err);
      return {
        success: false,
        message: err.message || 'Failed to add product'
      };
    }
  }

  /**
   * Remove a product from the shipment
   */
  async removeProduct(productVarietyId, reason = null) {
    try {
      const { data, error } = await this.supabase.rpc('remove_product_from_shipment', {
        p_shipment_id: this.shipmentId,
        p_product_variety_id: productVarietyId,
        p_reason: reason
      });

      if (error) throw error;

      // Reload products
      await this.loadShipmentProducts();

      return {
        success: true,
        message: 'Product removed successfully'
      };
    } catch (err) {
      console.error('Error removing product:', err);
      return {
        success: false,
        message: err.message || 'Failed to remove product'
      };
    }
  }

  /**
   * Update product details
   */
  async updateProduct(productVarietyId, updates, reason = null) {
    try {
      const { data, error } = await this.supabase.rpc('update_shipment_product', {
        p_shipment_id: this.shipmentId,
        p_product_variety_id: productVarietyId,
        p_quantity: updates.quantity || null,
        p_unit: updates.unit || null,
        p_rate: updates.rate || null,
        p_amount: updates.amount || null,
        p_reason: reason
      });

      if (error) throw error;

      // Reload products
      await this.loadShipmentProducts();

      return {
        success: true,
        message: 'Product updated successfully'
      };
    } catch (err) {
      console.error('Error updating product:', err);
      return {
        success: false,
        message: err.message || 'Failed to update product'
      };
    }
  }

  /**
   * Get product change history
   */
  async getChangeHistory(limit = 50) {
    try {
      const { data, error } = await this.supabase.rpc('get_shipment_product_history', {
        p_shipment_id: this.shipmentId,
        p_limit: limit
      });

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error loading change history:', err);
      throw err;
    }
  }

  /**
   * Get full change history with details from view
   */
  async getDetailedHistory(limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from('v_shipment_products_history')
        .select('*')
        .eq('shipment_id', this.shipmentId)
        .order('changed_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('Error loading detailed history:', err);
      throw err;
    }
  }

  /**
   * Get commodities grouped by name
   */
  getCommodities() {
    const commodityMap = new Map();
    
    this.productVarieties.forEach(pv => {
      if (pv.commodity) {
        if (!commodityMap.has(pv.commodity.id)) {
          commodityMap.set(pv.commodity.id, {
            id: pv.commodity.id,
            name: pv.commodity.name,
            varieties: []
          });
        }
        commodityMap.get(pv.commodity.id).varieties.push(pv);
      }
    });

    return Array.from(commodityMap.values());
  }

  /**
   * Get varieties for a specific commodity
   */
  getVarietiesByCommodity(commodityId) {
    return this.productVarieties.filter(pv => pv.commodity_id === commodityId);
  }

  /**
   * Check if product already exists in shipment
   */
  hasProduct(productVarietyId) {
    return this.products.some(p => p.product_variety_id === productVarietyId);
  }

  /**
   * Get product by variety ID
   */
  getProduct(productVarietyId) {
    return this.products.find(p => p.product_variety_id === productVarietyId);
  }

  /**
   * Format action for display
   */
  static formatAction(action) {
    const actionMap = {
      'added': 'Added',
      'removed': 'Removed',
      'quantity_changed': 'Quantity Changed',
      'unit_changed': 'Unit Changed',
      'rate_changed': 'Rate Changed',
      'amount_changed': 'Amount Changed'
    };
    return actionMap[action] || action;
  }

  /**
   * Format change description
   */
  static formatChangeDescription(change) {
    switch (change.action) {
      case 'added':
        return `Added ${change.new_quantity} ${change.new_unit}`;
      case 'removed':
        return `Removed ${change.old_quantity} ${change.old_unit}`;
      case 'quantity_changed':
        return `Changed quantity from ${change.old_quantity} to ${change.new_quantity}`;
      case 'unit_changed':
        return `Changed unit from ${change.old_unit} to ${change.new_unit}`;
      case 'rate_changed':
        return `Changed rate from ${change.old_rate} to ${change.new_rate}`;
      case 'amount_changed':
        return `Changed amount from ${change.old_amount} to ${change.new_amount}`;
      default:
        return 'Modified';
    }
  }
}
