export const asset = (path: string) => import.meta.env.BASE_URL + path;
export const electricityGuide = 'Електрика.%20Лабораторні%20роботи.pdf';
export const mechanicsGuide = 'mechanics-methodical-guide.pdf';
export const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const tabs = [
  ['experiment', 'Експеримент'],
  ['theory', 'Теорія'],
  ['questions', 'Контрольні питання'],
  ['equipment', 'Обладнання'],
] as const;
export const tabNames = tabs.map(([id]) => id);

type NavItem = { id: number; short: string };
type Subject = 'electricity' | 'mechanics';
const subjects: Record<Subject, string> = {
  electricity: 'Електрика',
  mechanics: 'Механіка і молекулярна фізика',
};

export function labLayout(subject: Subject, labs: NavItem[], active: number, title: string, content: string) {
  const prefix = subject === 'mechanics' ? '#/mechanics' : '#/lab';
  const guide = asset(subject === 'mechanics' ? mechanicsGuide : electricityGuide);
  return `<a href="#workspace" class="skip-link">Перейти до досліду</a>
    <aside id="sidebar" class="sidebar">
      <div class="subject-picker">
        <span aria-hidden="true">${subjects[subject]}</span>
        <select id="lab-subject" aria-label="Розділ фізики">
          ${Object.entries(subjects).map(([value, label]) =>
            `<option value="${value}"${subject === value ? ' selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <nav aria-label="Лабораторні роботи">${labs.map(lab =>
        `<a href="${prefix}/${lab.id}" class="nav-item ${lab.id === active ? 'active' : ''}" ${lab.id === active ? 'aria-current="page"' : ''}>
        <span class="nav-number">${String(lab.id).padStart(2, '0')}</span><span>${escapeHtml(lab.short)}</span>${lab.id === active ? '<span class="nav-arrow">↗</span>' : ''}</a>`).join('')}</nav>
    </aside>
    <main id="workspace" tabindex="-1">
      <header class="topbar">
        <div class="tabs" role="tablist" aria-label="Розділи лабораторної">${tabs.map(([id, label], index) =>
          `<button id="tab-${id}" role="tab" aria-selected="${index === 0}" aria-controls="panel-${id}" ${index ? 'tabindex="-1"' : ''} data-tab="${id}">${label}<span>0${index + 1}</span></button>`).join('')}</div>
        <div class="top-actions">
          <a class="source-link" href="${guide}" target="_blank" rel="noopener">Методичка <span>↗</span></a>
          <button id="menu" class="menu-button" aria-expanded="false" aria-controls="sidebar">Роботи ☰</button>
        </div>
      </header>
      <div class="content-body"><h1 class="sr-only">${escapeHtml(title)}</h1>${content}</div>
    </main>
    <div id="toast" role="status" hidden></div>
    <dialog id="image-dialog"><button class="dialog-close" aria-label="Закрити зображення">×</button><img alt=""><p></p></dialog>`;
}

export function showFigure(url: string, caption: string) {
  const dialog = document.querySelector<HTMLDialogElement>('#image-dialog')!;
  const img = dialog.querySelector('img')!;
  img.src = asset(url);
  img.alt = caption;
  dialog.querySelector('p')!.textContent = caption;
  dialog.showModal();
}
