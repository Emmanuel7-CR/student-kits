import { el } from './dom';

export type Row = Record<string, string>;
export interface FieldDef {
  key: string;
  label: string;
  type?: 'text' | 'textarea';
  placeholder?: string;
  /** Takes the full width of the row on wide screens. */
  wide?: boolean;
}

/**
 * A repeatable block of fields (one card per entry). Typing updates the row in place and calls onChange.
 * Adding or removing an entry rebuilds the cards, so focus is never stolen while typing.
 */
export function groupEditor(container: HTMLElement, noun: string, fields: FieldDef[], rows: Row[], onChange: () => void, blank: () => Row) {
  function build() {
    container.replaceChildren(
      ...rows.map((row, i) =>
        el(
          'div',
          { class: 'rounded-lg border border-border p-3' },
          el(
            'div',
            { class: 'mb-2 flex items-center justify-between gap-2' },
            el('span', { class: 'text-sm font-semibold' }, `${noun} ${i + 1}`),
            el('button', { type: 'button', class: 'btn btn-quiet', 'aria-label': `Remove ${noun.toLowerCase()} ${i + 1}`, onclick: () => remove(i) }, 'Remove'),
          ),
          el(
            'div',
            { class: 'grid gap-3 sm:grid-cols-2' },
            ...fields.map((f) => {
              const common = {
                class: f.type === 'textarea' ? 'textarea' : 'input',
                value: row[f.key] ?? '',
                placeholder: f.placeholder ?? '',
                maxLength: f.type === 'textarea' ? 1200 : 160,
                oninput: (e: Event) => {
                  row[f.key] = (e.target as HTMLInputElement).value;
                  onChange();
                },
              };
              const control = f.type === 'textarea' ? el('textarea', { ...common, rows: 3 }) : el('input', { ...common, type: 'text' });
              return el('label', { class: 'field' + (f.wide || f.type === 'textarea' ? ' sm:col-span-2' : '') }, el('span', { class: 'label' }, f.label), control);
            }),
          ),
        ),
      ),
    );
  }
  function remove(i: number) {
    rows.splice(i, 1);
    build();
    onChange();
  }
  function add() {
    rows.push(blank());
    build();
    onChange();
    const last = container.lastElementChild?.querySelector('input,textarea') as HTMLElement | null;
    last?.focus();
  }
  build();
  return { add, rebuild: build };
}
