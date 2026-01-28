/**
 * CommodityService
 * Handles commodity and measurement unit API calls
 */
export class CommodityService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
  }

  /**
   * Get all commodities
   */
  async getCommodities() {
    const { data, error } = await this.supabase
      .from('commodity')
      .select('id, name')
      .order('name');

    if (error) {
      throw new Error(`Failed to load commodities: ${error.message}`);
    }

    return data;
  }

  /**
   * Add new commodity
   */
  async addCommodity(name) {
    const { data, error } = await this.supabase
      .from('commodity')
      .insert({ name })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to add commodity: ${error.message}`);
    }

    return data;
  }

  /**
   * Get measurement units for a commodity
   */
  async getMeasurementUnits(commodityId) {
    const { data, error } = await this.supabase
      .from('measurement_unit')
      .select('unit_name')
      .eq('commodity_id', commodityId);

    if (error) {
      throw new Error(`Failed to load measurement units: ${error.message}`);
    }

    return data;
  }
}
