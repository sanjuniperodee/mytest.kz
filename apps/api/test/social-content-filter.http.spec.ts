import { containsBlockedContent } from "../src/modules/social/domain/content-filter";

describe("social content filter", () => {
  it("blocks obvious abuse, including separators and look-alike letters", () => {
    for (const text of [
      "ты пиздец как надоел",
      "иди нахуй",
      "х у й",
      "х.у.й тебе",
      "xуй",
      "fuck you",
      "You are a bitch",
      "сиктир кет",
      "Пидор!",
      "с у к а",
    ])
      expect(containsBlockedContent(text, [])).toBe(true);
  });

  it("lets ordinary study talk through", () => {
    for (const text of [
      "Как решить задачу по математике про логарифмы?",
      "Помогите с историей Казахстана, тема Алаш",
      "Тест по химии: ебонит — это материал?",
      "Купил на ebay учебник, Хуан пришёл",
      "сукно и суконный завод",
      "Сегодня набрал 118 баллов на пробном ЕНТ 🎉",
      "Мен ҰБТ-ға дайындалып жатырмын",
      "Ебеня — глухая деревня",
    ])
      expect(containsBlockedContent(text, [])).toBe(false);
  });

  it("supports configured extra stems without a deploy", () => {
    expect(containsBlockedContent("тупица", [])).toBe(false);
    expect(containsBlockedContent("Ты тупица", ["тупиц"])).toBe(true);
  });
});
