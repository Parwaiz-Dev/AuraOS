import { reportsRepository } from './reports.repository';
import { DashboardReport, DailyRevenuePoint, InventoryAlert, TopSellingItem } from './reports.types';

export class ReportsService {
  async getDashboardReport(restaurantId: string): Promise<DashboardReport> {
    return reportsRepository.getDashboardReport(restaurantId);
  }

  async getTopSellingItems(restaurantId: string, limit: number): Promise<TopSellingItem[]> {
    return reportsRepository.getTopSellingItems(restaurantId, limit);
  }

  async getDailyRevenue(restaurantId: string, days: number): Promise<DailyRevenuePoint[]> {
    return reportsRepository.getDailyRevenue(restaurantId, days);
  }

  async getInventoryAlerts(restaurantId: string): Promise<InventoryAlert[]> {
    return reportsRepository.getInventoryAlerts(restaurantId);
  }
}

export const reportsService = new ReportsService();
