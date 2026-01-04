import {
  IProduct,
  IOrder,
  FormErrors,
  IOrderForm,
  IAppData,
  PaymentMethod,
  OrderRequestDTO,
  CartState,
} from '../types';
import { Model } from './base/Model';
import { IEvents } from './base/Events';

const EMPTY_ORDER: IOrder = {
  payment: 'card' as PaymentMethod,
  address: '',
  email: '',
  phone: '',
  total: 0,
  items: [],
};

export class AppData extends Model<IAppData> implements IAppData {
  catalog: IProduct[] = [];
  basket: IProduct[] = [];
  order: IOrder = { ...EMPTY_ORDER };
  formErrors: FormErrors = {};
  selectedProduct: IProduct | null = null;

  constructor(events: IEvents) {
    super(events);
  }

  // ================== КОРЗИНА ==================

  getTotalBasketPrice(): number {
    return this.basket.reduce((sum, p) => sum + (p.price ?? 0), 0);
  }

  getBasketAmount(): number {
    return this.basket.length;
  }

  addToBasket(product: IProduct): void {
    if (!this.basket.some((p) => p.id === product.id)) {
      this.basket.push(product);
    }
    this.emitChanges('cart:changed', { state: this.getCartState() });
  }

  deleteFromBasket(product: IProduct): void {
    this.basket = this.basket.filter((p) => p.id !== product.id);
    this.emitChanges('cart:changed', { state: this.getCartState() });
  }

  private clearBasket(): void {
    this.basket.length = 0;
    this.emitChanges('cart:cleared');
    this.emitChanges('cart:changed', { state: this.getCartState() });
  }

  private getCartState(): CartState {
    return {
      items: this.basket.map((p) => ({
        id: p.id,
        title: p.title,
        price: p.price ?? 0,
        count: 1,
      })),
      total: this.getTotalBasketPrice(),
      count: this.getBasketAmount(),
    };
  }

  // ================== КАТАЛОГ ==================

  setProducts(items: IProduct[]): void {
    this.catalog = items;
    this.emitChanges('catalog:loaded', { products: this.catalog });
  }

  // ================== SELECTED PRODUCT ==================

  setSelectedProduct(product: IProduct | null): void {
    this.selectedProduct = product;
    this.emitChanges('selectedProduct:changed', {});
  }

  getSelectedProduct(): IProduct | null {
    return this.selectedProduct;
  }

  // ================== ОШИБКИ ФОРМЫ ==================

  private setFormErrors(errors: FormErrors): void {
    this.formErrors = errors;
    this.emitChanges('formErrors:changed', { errors: this.formErrors });
  }

  /**
   * Обновляет ошибки конкретной группы полей,
   * предварительно очищая старые ошибки этой группы
   */
  private updateErrors(
    keys: (keyof IOrderForm)[],
    newErrors: FormErrors
  ): void {
    const next: FormErrors = { ...this.formErrors };
    keys.forEach((key) => delete next[key]);
    Object.assign(next, newErrors);
    this.setFormErrors(next);
  }

  // ================== ЗАКАЗ / ВАЛИДАЦИЯ ==================

  setOrderField<K extends keyof IOrderForm>(
    field: K,
    value: IOrderForm[K]
  ): void {
    this.order = { ...this.order, [field]: value } as IOrder;

    // валидируем оба шага — это безопасно
    this.validateOrder();
    this.validateContacts();
  }

  validateOrder(): void {
    const errors: FormErrors = {};

    if (!this.order.address) {
      errors.address = 'Необходимо указать адрес';
    }

    if (!this.order.payment) {
      errors.payment = 'Необходимо указать способ оплаты';
    }

    this.updateErrors(['address', 'payment'], errors);

    const valid = !errors.address && !errors.payment;
    this.emitChanges('order:step-valid', { step: 1, valid });
  }

  validateContacts(): void {
    const errors: FormErrors = {};

    if (!this.order.email) {
      errors.email = 'Необходимо указать email';
    }

    if (!this.order.phone) {
      errors.phone = 'Необходимо указать телефон';
    }

    this.updateErrors(['email', 'phone'], errors);

    const valid = !errors.email && !errors.phone;
    this.emitChanges('order:step-valid', { step: 2, valid });
  }

  clearOrderData(): void {
    this.clearBasket();
    this.order = { ...EMPTY_ORDER };
    this.setFormErrors({});
    this.selectedProduct = null;
  }

  // ================== DTO ДЛЯ API ==================

  toOrderRequest(): OrderRequestDTO {
    return {
      // по ревью: ТОЛЬКО массив id
      items: this.basket.map((p) => p.id),
      payment: this.order.payment,
      address: this.order.address,
      email: this.order.email,
      phone: this.order.phone,
    };
  }
}
