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

  // ===== Корзина =====

  getTotalBasketPrice(): number {
    return this.basket.reduce((sum, next) => sum + (next.price ?? 0), 0);
  }

  addToBasket(product: IProduct): void {
    if (!this.basket.some(item => item.id === product.id)) {
      this.basket.push(product);
    }
    this.emitChanges('cart:changed', { state: this.getCartState() });
  }

  deleteFromBasket(product: IProduct): void {
    this.basket = this.basket.filter(item => item.id !== product.id);
    this.emitChanges('cart:changed', { state: this.getCartState() });
  }

  getBasketAmount(): number {
    return this.basket.length;
  }

  private clearBasket(): void {
    this.basket.length = 0;
    this.emitChanges('cart:cleared'); 
    this.emitChanges('cart:changed', { state: this.getCartState() });
  }

  private getCartState(): CartState {
  return {
    items: this.basket.map(p => ({
      id: p.id,
      title: p.title,
      price: p.price ?? 0,
      count: 1,
    })),
    total: this.getTotalBasketPrice(),
    count: this.getBasketAmount(),
  };
}

  // ===== Каталог =====

  setProducts(items: IProduct[]): void {
    this.catalog = items;
    this.emitChanges('catalog:loaded', { products: this.catalog });
  }

  // ===== Заказ / валидация =====

  setOrderField<K extends keyof IOrderForm>(field: K, value: IOrderForm[K]): void {
    this.order = { ...this.order, [field]: value } as IOrder;
    this.validateOrder();
    this.validateContacts();
  }

  validateContacts(): void {
    const errors: typeof this.formErrors = {};
    if (!this.order.email) errors.email = 'Необходимо указать email';
    if (!this.order.phone) errors.phone = 'Необходимо указать телефон';

    this.formErrors = { ...this.formErrors, ...errors };
    const valid = !errors.email && !errors.phone;
    this.emitChanges('order:step-valid', { step: 2, valid });
  }

  validateOrder(): void {
    const errors: typeof this.formErrors = {};
    if (!this.order.address) errors.address = 'Необходимо указать адрес';
    if (!this.order.payment) errors.payment = 'Необходимо указать способ оплаты';

    this.formErrors = { ...this.formErrors, ...errors };
    const valid = !errors.address && !errors.payment;
    this.emitChanges('order:step-valid', { step: 1, valid });
  }

  clearOrderData(): void {
    this.clearBasket();
    this.order = { ...EMPTY_ORDER };
    this.formErrors = {};
  }

  setSelectedProduct(product: IProduct | null): void {
    this.selectedProduct = product;
    this.emitChanges('selectedProduct:changed', { product });
  }

  // DTO для API
  toOrderRequest(): OrderRequestDTO {
    return {
      items: this.basket.map((p) => ({ id: p.id, quantity: 1 })),
      payment: this.order.payment,
      address: this.order.address,
      email: this.order.email,
      phone: this.order.phone,
    };
  }
}