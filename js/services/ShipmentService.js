/**
 * ShipmentService
 * Handles all shipment-related API calls
 */
export class ShipmentService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Generate next shipment reference code
   */
  async generateReferenceCode(shipmentType) {
    const { data, error } = await this.supabase.rpc('get_next_shipment_reference', { 
      p_shipment_type: shipmentType 
    });

    if (error) {
      throw new Error(`Failed to generate reference code: ${error.message}`);
    }

    return data;
  }

  /**
   * Create a new shipment
   */
  async createShipment(shipmentData, userId) {
    const { data, error } = await this.supabase
      .from('shipment')
      .insert({
        reference_code: shipmentData.reference_code,
        created_by: userId,
        type: shipmentData.type,
        payment_term_id: shipmentData.payment_term_id,
        mode_of_transport: shipmentData.mode_of_transport,
        inco_term: shipmentData.inco_term,
        freight_charges: shipmentData.freight_charges
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create shipment: ${error.message}`);
    }

    return data;
  }

  /**
   * Add products to shipment
   */
  async addProductsToShipment(shipmentId, products) {
    const productsToInsert = products.map(product => ({
      shipment_id: shipmentId,
      product_variety_id: product.product_variety_id,
      quantity: product.quantity,
      unit: product.unit
    }));

    const { error } = await this.supabase
      .from('shipment_products')
      .insert(productsToInsert);

    if (error) {
      throw new Error(`Failed to add products: ${error.message}`);
    }

    return true;
  }

  /**
   * Delete a shipment (rollback on error)
   */
  async deleteShipment(shipmentId) {
    const { error } = await this.supabase
      .from('shipment')
      .delete()
      .eq('id', shipmentId);

    if (error) {
      console.error('Failed to delete shipment:', error);
    }
  }

  /**
   * Get payment terms
   */
  async getPaymentTerms() {
    const { data, error } = await this.supabase
      .from('payment_terms')
      .select('id, name')
      .order('name');

    if (error) {
      throw new Error(`Failed to load payment terms: ${error.message}`);
    }

    return data;
  }

  /**
   * Get product varieties
   */
  async getProductVarieties() {
    const { data, error } = await this.supabase
      .from('product_variety')
      .select('id, product_name, variety_name, commodity_id');

    if (error) {
      throw new Error(`Failed to load product varieties: ${error.message}`);
    }

    return data;
  }
}
