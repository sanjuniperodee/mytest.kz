import { qotdPlainText } from '../src/modules/telegram/qotd-channel.service';

describe('question of the day for the Telegram channel', () => {
  it('turns simple question HTML into plain text', () => {
    expect(qotdPlainText('<p>Юридическая ответственность наступает за</p>')).toBe('Юридическая ответственность наступает за');
    expect(qotdPlainText('A &amp; B<br/>C')).toBe('A & B\nC');
  });

  it('skips questions with rendered formulas (they are posted as a link instead)', () => {
    expect(qotdPlainText('<span class="katex"><span class="katex-mathml">x</span></span>')).toBeNull();
  });
});
