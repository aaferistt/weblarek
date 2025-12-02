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
    modal.close();
  },
});


// ===== helpers

function openPreview(item: IProduct) {
  const previewView = new CardPreview(cloneTemplate(tplCardPreview), {
    onClick: () => {
      const currentProduct = appData.catalog.find(p => p.id === item.id);
      if (!currentProduct) return;

      if (currentProduct.selected) {
        events.emit('product:remove', { productId: currentProduct.id });
      } else {
        events.emit('product:add', { productId: currentProduct.id });
      }
    },
  });

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

events.on('catalog:loaded', ({ products }: { products: IProduct[] }) => {
  page.gallery = products.map((item) => {
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


events.on('product:open', ({ productId }: { productId: string }) => {
  const item = appData.catalog.find((p) => p.id === productId);
  appData.setSelectedProduct(item || null);
});

events.on('selectedProduct:changed', ({ product }: { product: IProduct | null }) => {
  if (product) {
    openPreview(product);
  }
});

// ———— ДОБАВЛЕНИЕ / УДАЛЕНИЕ ————

events.on('product:add', ({ productId }: { productId: string }) => {
  const item = appData.catalog.find(p => p.id === productId);
  if (!item) return;

  item.selected = true;
  appData.addToBasket(item);
  modal.close();
});

events.on('product:remove', ({ productId }: { productId: string }) => {
  const item = appData.catalog.find(p => p.id === productId);
  if (!item) return;

  item.selected = false;
  appData.deleteFromBasket(item);
  modal.close();
});

// ———— КОРЗИНА ————

events.on('cart:open', () => {
  renderBasketList();
  modal.render({
    content: basketView.render(), 
  });
});

events.on('cart:changed', () => {
  renderBasketList();
  page.counter = appData.getBasketAmount(); 
});

// ———— ЗАКАЗ ————

events.on('checkout:open-step1', () => {
  modal.render({
    content: orderView.render({
      address: appData.order.address || '',
      valid: false,
      errors: [],
    }),
  });
});

events.on('order:step-valid', ({ step, valid }: { step: 1 | 2; valid: boolean }) => {
  if (step === 1) orderView.valid = valid;
  if (step === 2) contactsView.valid = valid;
});

events.on(
  'orderInput:change',
  ({ field, value }: { field: keyof IOrderForm; value: string }) => {
    appData.setOrderField(field, value);
  }
);

events.on('order:submit', () => {
  modal.render({
    content: contactsView.render({
      email: appData.order.email || '',
      phone: appData.order.phone || '',
      valid: false,
      errors: [],
    }),
  });
});

events.on('contacts:submit', () => {
  const dto: OrderRequestDTO = appData.toOrderRequest();
  api
    .post('/order', dto)
    .then((res: { orderId: string; total?: number }) => {
      appData.clearOrderData();
      modal.render({
        content: successView.render({
          total: res.total ?? appData.getTotalBasketPrice(),
        }),
      });
    })
    .catch(console.error);
});

// ———— МОДАЛКА ————

events.on('modal:open', () => (page.locked = true));
events.on('modal:close', () => (page.locked = false));