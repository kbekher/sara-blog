/**
 * Russian UI strings — the primary dictionary. Its shape is the `Dictionary` type that uk/en must satisfy.
 *
 * Conventions:
 *  - `{name}` placeholders are filled with `fmt()` from `../get-dictionary`.
 *  - Plural-sensitive strings are `PluralForms` objects, resolved with `plural()` (Intl.PluralRules categories).
 *  - Values must stay plain strings (no functions) so slices of the dictionary can be passed to Client Components.
 */

/** Intl.PluralRules categories. Russian & Ukrainian use one/few/many; English only one/other. */
export type PluralForms = { one: string; few?: string; many?: string; other: string };

/** A link-bearing sentence split into parts: `${before}<link>${link}</link>${after}`. */
export type LinkedText = { before: string; link: string; after: string };

const ru = {
  meta: {
    homeTitle: "Мысли о жизни",
    tagsTitle: "Темы",
    tagsDescription: "Все темы, о которых я пишу.",
    tagTitle: "Тема «{tag}»",
    tagDescription: "Записи на тему «{tag}».",
    searchTitle: "Поиск",
    searchDescription: "Поиск по всем записям блога.",
    pageTitle: "Страница {page}",
    rssTitle: "{site} — RSS (русский)",
  },
  a11y: {
    skipToContent: "Перейти к содержанию",
    mainNav: "Основная навигация",
    footerNav: "Навигация в подвале",
    openMenu: "Открыть меню",
    closeMenu: "Закрыть меню",
    pagination: "Страницы",
    breadcrumbs: "Навигационная цепочка",
    home: "{site} — на главную",
  },
  nav: {
    home: "Главная",
    tags: "Темы",
    search: "Поиск",
  },
  theme: {
    label: "Тема оформления",
    dark: "Тёмная",
    light: "Светлая",
    system: "Как в системе",
    current: "Тема: {theme}. Нажмите, чтобы переключить",
  },
  language: {
    label: "Язык",
    switchTo: "Читать на языке: {language}",
  },
  home: {
    eyebrow: "Личный блог",
    featured: "Главное",
    latest: "Новое",
    morePosts: "Другие записи",
    emptyTitle: "Здесь пока тихо",
    emptyText: "Первые тексты уже пишутся. Подпишитесь на рассылку — и я напишу вам, как только они появятся.",
    readPost: "Читать",
  },
  pagination: {
    newer: "Новее",
    older: "Раньше",
    pageOf: "Страница {page} из {total}",
  },
  post: {
    back: "Все записи",
    readingTime: {
      one: "{n} минута чтения",
      few: "{n} минуты чтения",
      many: "{n} минут чтения",
      other: "{n} минуты чтения",
    } as PluralForms,
    publishedOn: "Опубликовано",
    updatedOn: "Обновлено {date}",
    machineTranslated: {
      ru: "Переведено автоматически с русского",
      uk: "Переведено автоматически с украинского",
      en: "Переведено автоматически с английского",
    },
    readOriginal: "Читать оригинал",
    notTranslated: {
      before: "Эта запись ещё не переведена на русский, поэтому здесь показан оригинал. ",
      link: "Открыть оригинальную страницу",
      after: "",
    } as LinkedText,
    photoCredit: { before: "Фото: ", middle: " на ", after: "" },
    tags: "Темы",
    share: "Поделиться",
    shareNative: "Поделиться…",
    copyLink: "Скопировать ссылку",
    copied: "Ссылка скопирована",
    copyFailed: "Не удалось скопировать",
    previous: "Предыдущая запись",
    next: "Следующая запись",
    moreReading: "Читать дальше",
    by: "Автор",
  },
  tags: {
    title: "Темы",
    intro: "Записи, собранные по темам.",
    count: {
      one: "{n} запись",
      few: "{n} записи",
      many: "{n} записей",
      other: "{n} записи",
    } as PluralForms,
    emptyTitle: "Тем пока нет",
    emptyText: "Как только появятся записи, здесь будут темы, по которым их удобно читать.",
    allTags: "Все темы",
    taggedEyebrow: "Тема",
  },
  search: {
    title: "Поиск",
    label: "Поиск по блогу",
    placeholder: "Что вы ищете?",
    clear: "Очистить",
    hint: "Введите хотя бы два символа — поиск идёт по заголовкам и текстам записей.",
    searching: "Ищу…",
    results: {
      one: "Нашлась {n} запись",
      few: "Нашлось {n} записи",
      many: "Нашлось {n} записей",
      other: "Нашлось {n} записи",
    } as PluralForms,
    noResultsTitle: "Ничего не нашлось",
    noResultsText: "По запросу «{q}» ничего нет. Попробуйте другое слово или загляните в темы.",
  },
  newsletter: {
    title: "Письма от Сары",
    text: "Новые записи — прямо на почту. Без спама, только тексты.",
    emailLabel: "Электронная почта",
    placeholder: "you@example.com",
    submit: "Подписаться",
    submitting: "Подписываю…",
    successTitle: "Спасибо!",
    success: "Вы подписаны. Новые записи будут приходить на почту.",
    successConfirm: "Почти готово — проверьте почту и подтвердите подписку.",
    errorInvalid: "Похоже, в адресе ошибка. Проверьте его, пожалуйста.",
    errorGeneric: "Не получилось подписаться. Попробуйте ещё раз чуть позже.",
    errorRateLimit: "Слишком много попыток. Попробуйте через пару минут.",
    privacy: "Отписаться можно в любой момент — ссылка есть в каждом письме.",
  },
  footer: {
    rss: "RSS",
    languages: "Языки",
    rights: "Все права защищены.",
    subscribe: "Подписка",
  },
  notFound: {
    eyebrow: "Ошибка 404",
    title: "Такой страницы нет",
    text: "Возможно, ссылка устарела или в адресе опечатка. Зато на главной есть что почитать.",
    home: "На главную",
    search: "Поиск",
  },
  error: {
    eyebrow: "Что-то пошло не так",
    title: "Страница не загрузилась",
    text: "Произошла непредвиденная ошибка. Попробуйте обновить страницу — обычно это помогает.",
    retry: "Попробовать снова",
    home: "На главную",
  },
};

export type Dictionary = typeof ru;
export default ru;
