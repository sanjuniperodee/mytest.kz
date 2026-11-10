/**
 * «Оплатить за ученика»: ученик отправляет родителю ссылку /pay/<token>, родитель без входа
 * выбирает тариф и платит со своего Kaspi. Контракт публичных ответов API.
 */

export type ParentPayLang = 'ru' | 'kk';

export interface ParentPayLinkDto {
  url: string;
  /** ISO — после этого момента ссылка не открывается. */
  expiresAt: string;
}

export type ParentPayOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

export interface ParentPayOrderDto {
  orderId: string;
  status: ParentPayOrderStatus;
  paymentType: 'invoice' | 'qr';
  planCode: string;
  planName: string;
  amount: number;
  /** QR: ссылка, открывающая оплату в Kaspi (и содержимое QR-кода). У счёта её нет. */
  payUrl: string | null;
  /** ISO — до какого момента действует QR. У счёта срока нет. */
  expiresAt: string | null;
  /** Маска номера, на который ушёл счёт (+7 707 ** *** 34). */
  phoneMask: string | null;
  createdAt: string;
  paidAt: string | null;
  /** ISO — время сервера в момент ответа: обратный отсчёт не зависит от часов на телефоне. */
  serverTime: string;
}

export interface ParentPayInfoDto {
  /** Только имя — фамилию, телефон и почту ученика ссылка не раскрывает. */
  studentName: string | null;
  access: {
    active: boolean;
    /** ISO — до какой даты открыт платный доступ. */
    until: string | null;
  };
  /** Незавершённый или только что оплаченный платёж: страница продолжает с него. */
  order: ParentPayOrderDto | null;
  linkExpiresAt: string;
}

export interface ParentPayCheckoutRequestDto {
  planId: string;
  method: 'invoice' | 'qr';
  /** Обязателен для method = invoice. */
  phoneNumber?: string;
}
