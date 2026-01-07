import { ensureAllElements, ensureElement } from '../utils/utils';
import { Component } from './base/Component';
import { IEvents } from './base/Events';

interface IFormState {
  valid: boolean;
  errors: string | string[];
}

type InputLike = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export class Form<T> extends Component<IFormState> {
  protected _submit: HTMLButtonElement;
  protected _errors: HTMLElement;
  protected _inputs: InputLike[];

  constructor(protected container: HTMLFormElement, protected events: IEvents) {
    super(container);

    this._submit = ensureElement<HTMLButtonElement>(
      'button[type=submit]',
      this.container
    );
    this._errors = ensureElement<HTMLElement>('.form__errors', this.container);

    // ✅ По ревью: получаем коллекцию полей и вешаем слушатели на каждое поле
    this._inputs = [
      ...ensureAllElements<HTMLInputElement>('input[name]', this.container),
      ...ensureAllElements<HTMLTextAreaElement>('textarea[name]', this.container),
      ...ensureAllElements<HTMLSelectElement>('select[name]', this.container),
    ];

    this._inputs.forEach((input) => {
      input.addEventListener('input', () => {
        const field = input.name as keyof T;
        const value = input.value;
        this.onInputChange(field, value);
      });
    });

    // Сабмит формы
    this.container.addEventListener('submit', (e: Event) => {
      e.preventDefault();
      // имена форм в HTML: name="order" и name="contacts"
      this.events.emit(`${this.container.name}:submit`);
    });
  }

  protected onInputChange(field: keyof T, value: string) {
    this.events.emit('orderInput:change', { field, value });
  }

  set valid(value: boolean) {
    this._submit.disabled = !value;
  }

  set errors(value: string | string[]) {
    const msg = Array.isArray(value) ? value.join(', ') : value;
    this.setText(this._errors, msg);
  }

  render(state: Partial<T> & Partial<IFormState>) {
    const { valid, errors, ...inputs } = state ?? {};
    if (typeof valid === 'boolean') this.valid = valid;
    if (typeof errors !== 'undefined') this.errors = errors!;
    // прокинуть значения инпутов через сеттеры дочерних форм
    Object.assign(this as object, inputs);
    return this.container;
  }
}
