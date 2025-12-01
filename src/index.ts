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