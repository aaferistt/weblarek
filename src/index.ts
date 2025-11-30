// src/index.ts
import './scss/styles.scss';

import { Api } from './components/base/Api';
import { AppData } from './components/AppData';
import { EventEmitter } from './components/base/Events';

import { Card, CardPreview } from './components/Card';
import { Basket, BasketItem } from './components/Basket';
import { Order } from './components/Order';
import { Contacts } from './components/Contact';
import { Success } from './components/Success';
import { Page } from './components/Page';
import { Modal } from './components/Modal';

import { ensureElement, cloneTemplate } from './utils/utils';
import { IOrderForm, IProduct, IProductResponse, OrderRequestDTO } from './types';
import { API_URL } from './utils/constants';

// ---- core singletons
const api = new Api(API_URL);
const events = new EventEmitter();
const page = new Page(document.body, events);
const appData = new AppData(events);

// ---- templates & widgets 

const modal = new Modal(ensureElement<HTMLElement>('#modal-container'), events);

const tplCardCatalog = ensureElement<HTMLTemplateElement>('#card-catalog');
const tplCardPreview = ensureElement<HTMLTemplateElement>('#card-preview');
const tplBasket = ensureElement<HTMLTemplateElement>('#basket');
const tplBasketItem = ensureElement<HTMLTemplateElement>('#card-basket');
const tplOrder = ensureElement<HTMLTemplateElement>('#order');
const tplContacts = ensureElement<HTMLTemplateElement>('#contacts');
const tplSuccess = ensureElement<HTMLTemplateElement>('#success');

const basketView = new Basket(cloneTemplate(tplBasket), events);
const orderView = new Order(cloneTemplate(tplOrder), events);
const contactsView = new Contacts(cloneTemplate(tplContacts), events);
const successView = new Success(cloneTemplate(tplSuccess), {
  onClick: () => {
    events.emit('modal:close');
    modal.close();
  },
});

const previewView = new CardPreview(cloneTemplate(tplCardPreview), {
  onClick: () => {
    console.warn('Preview onClick not initialized');
  },
});

// ===== helpers
function openPreview(item: IProduct) {
  previewView.onClick = () => {
    events.emit(item.selected ? 'product:remove' : 'product:add', {
      productId: item.id,
    });
  };

  modal.render({
    content: previewView.render({
      id: item.id,
      title: item.title,
      image: item.image,
      category: item.category,
      description: item.description,
      price: item.price,
      selected: item.selected,
    }),
  });
}

function renderBasketList() {
  const items = appData.basket.map((item, index) => {
    const view = new BasketItem(cloneTemplate(tplBasketItem), {
      onClick: () => events.emit('product:remove', { productId: item.id }),
    });
    return view.render({
      title: item.title,
      price: item.price ?? 0,
      index: index + 1,
      id: item.id,
      image: item.image,
      category: item.category,
      description: item.description,
      selected: item.selected,
    });
  });

  basketView.items = items;
  basketView.total = appData.getTotalBasketPrice();
}

// ===== bootstrap data + диагностика
events.onAll((e) => console.log('[event]', e));

api
  .get('/product')
  .then((res: IProductResponse) => {
    const items = Array.isArray(res?.items) ? res.items : [];
    appData.setProducts(items);
  })
  .catch((err) => {
    console.error('[api]/product error:', err);
    appData.setProducts([]);
  });

// ===== Events wiring

// каталог загружен -> рисуем карточки
events.on('catalog:loaded', (data: { products: IProduct[] }) => {
  page.gallery = data.products.map((item) => {
    const card = new Card(cloneTemplate(tplCardCatalog), {
      onClick: () => events.emit('product:open', { productId: item.id }),
    });
    return card.render({
      id: item.id,
      title: item.title,
      image: item.image,
      category: item.category,
      price: item.price,
      selected: item.selected,
      description: item.description,
    });
  });
});

// открыть карточку товара
events.on('product:open', ({ productId }: { productId: string }) => {
  const item = appData.catalog.find((p) => p.id === productId);
  appData.setSelectedProduct(item || null); // ← обновляем модель
});

events.on('selectedProduct:changed', ({ product }: { product: IProduct | null }) => {
  if (product) {
    openPreview(product);
  }
});

// добавить в корзину
events.on('product:add', ({ productId }: { productId: string }) => {
  const item = appData.catalog.find(p => p.id === productId);
  if (!item) return;

  item.selected = true;
  appData.addToBasket(item);
  page.counter = appData.getBasketAmount();
  modal.close();
});

// удалить из корзины
events.on('product:remove', ({ productId }: { productId: string }) => {
    const item = appData.catalog.find(p => p.id === productId);
  if (!item) return;

  item.selected = false;
  appData.deleteFromBasket(item);
  page.counter = appData.getBasketAmount();
  modal.close();
});

// открыть корзину
events.on('cart:open', () => {
  modal.render({
  content: basketView.render({
    total: appData.getTotalBasketPrice(),
  }),
});
});

// состояние корзины изменилось
events.on('cart:changed', () => {
  renderBasketList();
});

// шаг 1 заказа
events.on('checkout:open-step1', () => {
  modal.render({
    content: orderView.render({
      address: '',
      valid: false,
      errors: [],
    }),
  });
});

// валидация шагов
events.on('order:step-valid', ({ step, valid }: { step: 1 | 2; valid: boolean }) => {
  if (step === 1) orderView.valid = valid;
  if (step === 2) contactsView.valid = valid;
});

// изменения полей форм
events.on(
  'orderInput:change',
  ({ field, value }: { field: keyof IOrderForm; value: string }) => {
    appData.setOrderField(field, value);
  }
);

// сабмит шага 1 -> контакты
events.on('order:submit', () => {
  modal.render({
    content: contactsView.render({
      valid: false,
      errors: [],
    }),
  });
});

// сабмит шага 2 -> отправка заказа
events.on('contacts:submit', () => {
  const dto: OrderRequestDTO = appData.toOrderRequest();
  api.post('/order', dto)
    .then((res: { orderId: string; total?: number }) => {
      events.emit('order:completed', { orderId: res.orderId });
      modal.render({
        content: successView.render({
          total: res.total ?? appData.getTotalBasketPrice(), // fallback на случай, если сервер не прислал
        }),
      });
      appData.clearOrderData();
      orderView.disableButtons?.();
      page.counter = 0;
    })
    .catch(console.error);
});

// модалка: блокировка страницы
events.on('modal:open', () => (page.locked = true));
events.on('modal:close', () => (page.locked = false));
