export type LoginCodeLanguage = 'ru' | 'kk';

export const LOGIN_CODE_MINUTES = 10;

const COPY = {
  ru: {
    subject: 'Код для входа в my-test.kz',
    intro: 'Код для входа в my-test.kz:',
    valid: `Код действует ${LOGIN_CODE_MINUTES} минут и подходит один раз.`,
    ignore:
      'Если вы не запрашивали код — ничего не делайте и никому его не сообщайте: он нужен только для входа в ваш аккаунт.',
  },
  kk: {
    subject: 'my-test.kz сайтына кіру коды',
    intro: 'my-test.kz сайтына кіру коды:',
    valid: `Код ${LOGIN_CODE_MINUTES} минут жарамды және бір рет қолданылады.`,
    ignore:
      'Егер сіз код сұрамаған болсаңыз — ештеңе жасамаңыз және кодты ешкімге айтпаңыз: ол тек аккаунтыңызға кіру үшін керек.',
  },
} as const;

export function loginCodeLanguage(preferredLanguage: string | null | undefined): LoginCodeLanguage {
  return preferredLanguage === 'kk' ? 'kk' : 'ru';
}

/** The code is digits only, so nothing in the HTML needs escaping. */
export function renderLoginCodeEmail(code: string, language: LoginCodeLanguage) {
  const copy = COPY[language];
  return {
    subject: copy.subject,
    text: `${copy.intro} ${code}\n\n${copy.valid}\n${copy.ignore}\n`,
    html: [
      '<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1a1a">',
      `<p>${copy.intro}</p>`,
      `<p style="font-size:32px;font-weight:bold;letter-spacing:6px;margin:16px 0">${code}</p>`,
      `<p>${copy.valid}</p>`,
      `<p style="color:#666;font-size:14px">${copy.ignore}</p>`,
      '</div>',
    ].join(''),
  };
}
