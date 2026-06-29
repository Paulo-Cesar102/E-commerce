export class CorreiosService {
  async estimateDeliveryDate(_zipCode?: string) {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    return date;
  }
}
