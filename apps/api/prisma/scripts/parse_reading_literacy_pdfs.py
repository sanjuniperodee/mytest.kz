#!/usr/bin/env python3
"""Parse extracted reading-literacy PDF .txt → reading-literacy-seed-data.json.

- Подставляет общий мәтін/текст ко всем вопросам одного номера текста, если в PDF
  текст дан один раз (типично KK 19), а дальше только «Мәтін 1 … вопрос».
- После сборки всех банков нумерация «Мәтін N / Текст N» сквозная между банками.

Запуск из apps/api: python3 prisma/scripts/parse_reading_literacy_pdfs.py
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, Optional

READING_DIR = Path(__file__).resolve().parent.parent / "extracted-pdf" / "reading"
OUT = Path(__file__).resolve().parent.parent / "reading-literacy-seed-data.json"

# Обязательное «:» у Жауап/Ответ — иначе «…екінші жауап B)» даёт ложное совпадение.
ANSWER_STRICT = re.compile(
    r"(?:Ответ|Жауап|Жауабы|Жауаб)\s*:\s*([ABCD])(?:\s*\)|\b)",
    re.IGNORECASE,
)
# «Ответ B)» без двоеточия (встречается в RU PDF)
ANSWER_LOOSE = re.compile(r"Ответ\s+([ABCD])\s*\)", re.IGNORECASE)


def split_answer_suffix(body: str) -> tuple[Optional[str], str]:
    """Берём последнее вхождение строки ответа (обычно в конце блока)."""
    best_m = None
    for m in ANSWER_STRICT.finditer(body):
        best_m = m
    if best_m:
        return best_m.group(1).upper(), body[: best_m.start()].strip()
    best_m = None
    for m in ANSWER_LOOSE.finditer(body):
        best_m = m
    if best_m:
        return best_m.group(1).upper(), body[: best_m.start()].strip()
    return None, body


FIRST_OPTION = re.compile(r"(?:^|\s)([ABCD])\)\s*", re.IGNORECASE)
OPTION_CHUNK = re.compile(
    r"([ABCD])\)\s*((?:(?!\s[A-D]\)\s*).)*)",
    re.IGNORECASE | re.DOTALL,
)

# Заголовок вопроса: Мәтін / Мəтін (ə U+0259) / Текст + номер
TEXT_HEAD = re.compile(
    r"^(М(?:(?:ә|е|\u0259|і|i)тін)|Текст)\s+(\d+)\s*(.*)$",
    re.IGNORECASE | re.DOTALL,
)

# Начало формулировки задания — по корпусу prisma/extracted-pdf/reading/*.txt
# (первые 3 токена вопроса после extract_passage_question_from_stem; дубликаты схлопнуты).
QUESTION_STARTERS = [
    r"Выберите\s+утверждения\s+соответствующие\s",  # 82-ru: 'Выберите утверждения, соответствующие тексту. 1.'
    r"Укажите\s+страну\-прототип\s+современных\s",  # 82-ru: 'Укажите страну-прототип современных офшорных зон'
    r"утверждение\s+соответствующее\s+тексту\s",  # 82-ru: 'утверждение, соответствующее тексту.'
    r"Утверждение\s+противоречащее\s+тексту\s",  # 19-ru: 'Утверждение, противоречащее тексту'
    r"Информация\s+соответствующая\s+тексту\s",  # 82-ru: 'Информация, соответствующая тексту'
    r"Қазақстанның\s+дəрілік\s+өсімдіктер\s",  # 35-kk: 'Қазақстанның дəрілік өсімдіктер əлеміне қандай т'
    r"Қыш\-құмыра\s+өндіру\s+тəсілдерінің\s",  # 35-kk: 'Қыш-құмыра өндіру тəсілдерінің бір-бірінен айырм'
    r"Венецианский\s+фестиваль\s+проходит\s",  # 82-ru: 'Венецианский фестиваль проходит каждый год'
    r"Статус\s+казахского\s+национального\s",  # 82-ru: 'Статус казахского национального вуза консерватор'
    r"Śmigus\-Dyngus\s+отмечается\s+после\s",  # 82-ru: 'Śmigus-Dyngus отмечается после'
    r"Мəтінде\s+эндемикалық\s+өсімдіктер\s",  # 35-kk: 'Мəтінде эндемикалық өсімдіктер қатарына жататын '
    r"Определите\s+троп\s+использованный\s",  # 82-ru: 'Определите троп, использованный в словосочетания'
    r"Выберите\s+неверное\s+утверждение\s",  # 19-ru: 'Выберите неверное утверждение.'
    r"Учебными\s+принадлежностями\s+для\s",  # 19-ru: 'Учебными принадлежностями для детей войны были'
    r"Төменгі\s+тұжырымдардың\s+қайсысы\s",  # 50-kk: 'Төменгі тұжырымдардың қайсысы дұрыс? 1. Жеке бал'
    r"Информация\s+не\s+соответствующая\s",  # 82-ru: 'Информация, не соответствующая тексту'
    r"Укажите\s+название\s+единственной\s",  # 82-ru: 'Укажите название единственной реки, вытекающей и'
    r"Укажите\s+неверное\s+утверждение\s",  # 19-ru: 'Укажите неверное утверждение.'
    r"Байбарыс\s+сұлтанның\s+Мəмлүктер\s",  # 35-kk: 'Байбарыс сұлтанның Мəмлүктер мемлекетінің күшеюі'
    r"Сарай\-Берке\s+қай\s+мемлекеттің\s",  # 50-kk: 'Сарай-Берке қай мемлекеттің астанасы?'
    r"Действие\s+рассказа\s+происходит\s",  # 82-ru: 'Действие рассказа происходит'
    r"Егінді\s+жинауға\s+атсалыспаған\s",  # 35-kk: 'Егінді жинауға атсалыспаған кім?'
    r"Бірінші\s+азатжолдағы\s+негізгі\s",  # 50-kk: 'Бірінші азатжолдағы негізгі ой'
    r"Бірінші\s+көрмеге\s+келушілерге\s",  # 50-kk: 'Бірінші көрмеге келушілерге қатысты ой'
    r"Рассказчик\s+предполагает\s+что\s",  # 82-ru: 'Рассказчик предполагает, что слово «родник» прои'
    r"Согласно\s+тексту\s+почтальоном\s",  # 82-ru: 'Согласно тексту, почтальоном Хогвартса является'
    r"Жігіттің\s+бойындағы\s+ешкімге\s",  # 35-kk: 'Жігіттің бойындағы ешкімге ұнамаған қасиеті?'
    r"Мəтіннен\s+шығатын\s+қорытынды\s",  # 35-kk: 'Мəтіннен шығатын қорытынды'
    r"Бейбарыс\s+сұлтанның\s+билікке\s",  # 35-kk: 'Бейбарыс сұлтанның билікке келуіне не себеп болд'
    r"Шырғаның\s+қандай\s+ерекшелігі\s",  # 35-kk: 'Шырғаның қандай ерекшелігі бар?'
    r"Мысыр\s+пирамидалары\s+несімен\s",  # 50-kk: 'Мысыр пирамидалары несімен ерекшеленеді?'
    r"Төреқұл\s+Айтматовтың\s+ұстазы\s",  # 50-kk: 'Төреқұл Айтматовтың ұстазы болған қазақ'
    r"Барлық\s+жүлдегерлерге\s+ортақ\s",  # 50-kk: 'Барлық жүлдегерлерге ортақ тігілген бағалы сый'
    r"Согласно\s+тексту\s+увлекались\s",  # 82-ru: 'Согласно тексту, увлекались спортом'
    r"Чувства\s+испытанные\s+автором\s",  # 82-ru: 'Чувства, испытанные автором у родника'
    r"Особую\s+прелесть\s+эдельвейсу\s",  # 82-ru: 'Особую прелесть эдельвейсу придает'
    r"Домбыра\s+қандай\s+стильдерде\s",  # 35-kk: 'Домбыра қандай стильдерде күй орындауға арналған'
    r"Мəтінде\s+Бейбарыс\s+сұлтанға\s",  # 35-kk: 'Мəтінде Бейбарыс сұлтанға қатысты не айтылмады?'
    r"Үрмелі\s+музыкалық\s+аспаптар\s",  # 50-kk: 'Үрмелі музыкалық аспаптар дегеніміз'
    r"Согласно\s+тексту\s+профессия\s",  # 82-ru: 'Согласно тексту, профессия флориста требует'
    r"Примета\s+туристов\s+желающих\s",  # 82-ru: 'Примета туристов, желающих вернуться в Рим'
    r"Согласно\s+тексту\s+требовать\s",  # 82-ru: 'Согласно тексту, требовать от средств массовой и'
    r"Согласно\s+тексту\s+настоящих\s",  # 82-ru: 'Согласно тексту, настоящих друзей легче обрести '
    r"Что\s+изначально\s+обозначал\s",  # 19-ru: 'Что изначально обозначал термин «личность»?'
    r"Қазақ\s+хандығының\s+құрылуы\s",  # 35-kk: 'Қазақ хандығының құрылуы неге негіз болды?'
    r"Қазақтар\s+домбыраны\s+қалай\s",  # 35-kk: 'Қазақтар домбыраны қалай құрметтейді?'
    r"Мəтіннің\s+соңғы\s+бөлігінде\s",  # 35-kk: 'Мəтіннің соңғы бөлігінде айтылған ой'
    r"Мереке\s+күндері\s+тағылатын\s",  # 50-kk: 'Мереке күндері тағылатын əшекей'
    r"Халықтың\s+Құлагерге\s+деген\s",  # 50-kk: 'Халықтың Құлагерге деген ерекше құрметі суреттел'
    r"Қабанбай\s+Дарабоз\s+атанған\s",  # 50-kk: 'Қабанбай Дарабоз атанған шайқас'
    r"Поющий\s+бархан\s+расположен\s",  # 82-ru: 'Поющий бархан расположен возле реки'
    r"согласно\s+тексту\s+получает\s",  # 82-ru: 'согласно тексту, получает приз'
    r"Пушкину\s+Когда\s+происходят\s",  # 82-ru: 'Пушкину) Когда происходят описываемые события?'
    r"Укажите\s+верные\s+параметры\s",  # 82-ru: 'Укажите верные параметры Байкала.'
    r"Согласно\s+тексту\s+понятия\s",  # 19-ru: 'Согласно тексту, понятия человек и личность'
    r"Определите\s+стиль\s+текста\s",  # 19-ru: 'Определите стиль текста.'
    r"Астананың\s+басты\s+көрнекі\s",  # 35-kk: 'Астананың басты көрнекі орындарының бірі қандай?'
    r"Аңшылардың\s+неше\s+бүркіті\s",  # 35-kk: 'Аңшылардың неше бүркіті бар?'
    r"Бата\s+қандай\s+жағдайларда\s",  # 35-kk: 'Бата қандай жағдайларда беріледі?'
    r"Домбыра\s+қай\s+материалдан\s",  # 35-kk: 'Домбыра қай материалдан жасалады?'
    r"Қырқынан\s+шығару\s+кезінде\s",  # 50-kk: 'Қырқынан шығару кезінде баланың тырнағын алады'
    r"Халықтың:\s+«Үміт\s+артсаң,\s",  # 50-kk: 'Халықтың: «Үміт артсаң, Үркерге қара!» – деуінің'
    r"Мəтін\s+бойынша\s+кесененің\s",  # 50-kk: 'Мəтін бойынша кесененің орнында бұрын не болған?'
    r"Согласно\s+тексту\s+Толстой\s",  # 82-ru: 'Согласно тексту, Толстой уверенно держался'
    r"Согласно\s+тексту\s+Фэйсбук\s",  # 82-ru: 'Согласно тексту, Фэйсбук является'
    r"Мəтін\s+мазмұнынан\s+алшақ\s",  # 35-kk: 'Мəтін мазмұнынан алшақ ойды табыңыз:'
    r"Қыздың\s+ұзатылуы\s+туралы\s",  # 50-kk: 'Қыздың ұзатылуы туралы сөз қозғалатын азат жол'
    r"Үрмелі\s+аспаптар\s+əскери\s",  # 50-kk: 'Үрмелі аспаптар əскери аспап ретінде қайда пайда'
    r"Тұжырымдардың\s+дұрысы\s+1\s",  # 50-kk: 'Тұжырымдардың дұрысы: 1. Терек баяу өседі. 2. Те'
    r"Автордың\s+жұлдыздар\s+мен\s",  # 50-kk: 'Автордың жұлдыздар мен түнгі аспанды суреттеген '
    r"Мəтіндегі\s+Үркер\s+сипаты\s",  # 50-kk: 'Мəтіндегі Үркер сипаты'
    r"Определите\s+стиль\s+текст\s",  # 82-ru: 'Определите стиль текст.'
    r"Утверждение\s+которое\s+не\s",  # 82-ru: 'Утверждение, которое не соответствует тексту'
    r"Согласно\s+тексту\s+молоко\s",  # 82-ru: 'Согласно тексту, молоко - универсальная пища, по'
    r"Согласно\s+источнику,\s+расшифровка\s",  # 82-ru: пчёлы — задание в конце, не «информацию о…» из мәтін
    r"согласно\s+тексту\s+можно\s",  # 19-ru: 'согласно тексту) можно сжечь за час интенсивного'
    r"Мəтінге\s+қайшы\s+тұжырым\s",  # 19-kk: 'Мəтінге қайшы тұжырым:'
    r"Қазақ\s+хандығын\s+кімдер\s",  # 35-kk: 'Қазақ хандығын кімдер құрды?'
    r"Мəтін\s+бойынша\s+дəрілік\s",  # 35-kk: 'Мəтін бойынша дəрілік өсімдіктердің басты ерекше'
    r"Бейбарыс\s+əскери\s+жолын\s",  # 35-kk: 'Бейбарыс əскери жолын неден бастады?'
    r"«Далбай»\s+қандай\s+шырға\s",  # 35-kk: '«Далбай» қандай шырға түрі?'
    r"Қазақтың\s+ерекше\s+ырымы\s",  # 50-kk: 'Қазақтың ерекше ырымы'
    r"Өңіржиектің\s+жасалу\s+жолының\s+реттілігін\s",  # 50-kk: реттілігін анықтаңыз (ішкі мәтіннен «мереке…» емес)
    r"Керней\s+аспабының\s+көне\s",  # 50-kk: 'Керней аспабының көне музыкалық аспап жəне оның '
    r"Мəтінге\s+лайық\s+тақырып\s",  # 50-kk: 'Мəтінге лайық тақырып'
    r"Лениндік\s+сыйлық\s+алған\s",  # 50-kk: 'Лениндік сыйлық алған шығармалар жинағы'
    r"«Жəмилə»\s+повесі\s+жарық\s",  # 50-kk: '«Жəмилə» повесі жарық көрген жыл'
    r"Абай\s+шешімінің\s+өзгеру\s",  # 50-kk: 'Абай шешімінің өзгеру себебі'
    r"Батырдың\s+азан\s+шақырып\s",  # 50-kk: 'Батырдың азан шақырып қойған есімі'
    r"Наивысшей\s+ценностью\s+в\s",  # 82-ru: 'Наивысшей ценностью в рассказе является понятие'
    r"Согласно\s+тексту\s+Сыдык\s",  # 82-ru: 'Согласно тексту, Сыдык Мухамеджанов – это'
    r"Основная\s+мысль\s+текста\s",  # 82-ru: 'Основная мысль текста'
    r"Лихачеву\s+Третий\s+абзац\s",  # 82-ru: 'Лихачеву) Третий абзац соотносится с выражением'
    r"Длина\s+береговой\s+линии\s+Байкала\s+равна",  # 82-ru: формулировка вопроса; короткий «Длина береговой…» ловит мәтін
    r"Согласно\s+тексту\s+суши\s",  # 19-ru: 'Согласно тексту, суши появились еще в'
    r"Бата\s+беру\s+дəстүрінің\s",  # 35-kk: 'Бата беру дəстүрінің негізгі мақсаты қандай?'
    r"Жарыс\s+қазан\s+ырымының\s",  # 35-kk: 'Жарыс қазан ырымының негізгі мақсаты қандай?'
    r"Қайнаған\s+суды\s+суытып\s",  # 50-kk: 'Қайнаған суды суытып, ішіне не салады?'
    r"Согласно\s+тексту\s+мгой\s",  # 82-ru: 'Согласно тексту, мгой в народе называют'
    r"Укажите\s+стиль\s+текста\s",  # 82-ru: 'Укажите стиль текста.'
    r"Термин\s+офшор\s+впервые\s",  # 82-ru: 'Термин «офшор» впервые появился'
    r"Пропущенное\s+слово\s+в\s",  # 19-ru: 'Пропущенное слово в ряду: Соль – Солнце – ?'
    r"Что\s+дает\s+регулярное\s",  # 19-ru: 'Что дает регулярное посещение бассейна? 1. Оно о'
    r"Мəтінде\s+жүзудің\s+қай\s",  # 19-kk: 'Мəтінде жүзудің қай жүйеге əсері туралы айтылмағ'
    r"Астана\s+қашан\s+астана\s",  # 35-kk: 'Астана қашан астана мəртебесіне ие болды?'
    r"Қазақ\s+хандығы\s+қашан\s",  # 35-kk: 'Қазақ хандығы қашан құрылды деп есептеледі?'
    r"Тары\s+кімге\s+бұйырады\s",  # 35-kk: 'Тары кімге бұйырады?'
    r"Қыш\s+құмыра\s+əдісінің\s",  # 35-kk: 'Қыш құмыра əдісінің соңғы сатылары?'
    r"Келін\s+үйдің\s+босаған\s",  # 50-kk: 'Келін үйдің босаған аттаған соң, сəлем береді'
    r"Мəтін\s+мазмұнына\s+сай\s",  # 50-kk: 'Мəтін мазмұнына сай тақырып'
    r"Мəтін\s+бойынша\s+қазақ\s",  # 50-kk: 'Мəтін бойынша қазақ халқының қыз баланы тəрбиеле'
    r"Қыз\s+бала\s+тəрбиесіне\s",  # 50-kk: 'Қыз бала тəрбиесіне қатысты пікір қай бөлімде сө'
    r"Үрмелі\s+аспаптың\s+бір\s",  # 50-kk: 'Үрмелі аспаптың бір түрі'
    r"Определите\s+тип\s+речи\s",  # 82-ru: 'Определите тип речи.'
    r"Укажите\s+тему\s+текста\s",  # 82-ru: 'Укажите тему текста.'
    r"Укажите\s+цель\s+текста\s",  # 82-ru: 'Укажите цель текста.'
    r"В\s+каком\s+предложении\s",  # 82-ru: 'В каком предложении встречается лексический повт'
    r"Согласно\s+тексту\s+при\s",  # 82-ru: 'Согласно тексту, при первой встрече с цветком эд'
    r"Согласно\s+тексту\s+не\s",  # 19-ru: 'Согласно тексту, не забывать Время – значит'
    r"Мəтінге\s+сəйкес\s+бір\s",  # 19-kk: 'Мəтінге сəйкес, бір сағат қарқынды жүзу кезінде '
    r"Құс\s+шырғаға\s+түскен\s",  # 35-kk: 'Құс шырғаға түскен кезде не істейді?'
    r"Баланың\s+шашын\s+неше\s",  # 50-kk: 'Баланың шашын неше күн алмайды?'
    r"Киімді\s+сəндеу\s+үшін\s",  # 50-kk: 'Киімді сəндеу үшін жасалатын əшекей'
    r"Мəтінде\s+жауабы\s+жоқ\s",  # 50-kk: 'Мəтінде жауабы жоқ сұрақ'
    r"Мəтін\s+бойынша\s+Əмір\s",  # 50-kk: 'Мəтін бойынша Əмір Темір Ахмет Яссауи кесенесін '
    r"Төле\s+бидің\s+билікке\s",  # 50-kk: 'Төле бидің билікке келуіне көмектесті'
    r"Информация\s+о\s+Марке\s",  # 82-ru: 'Информация о Марке Цукерберге отсутствует в текс'
    r"В\s+данном\s+контексте\s",  # 82-ru: 'В данном контексте слово тренд можно заменить фр'
    r"Какое\s+украшение\s+не\s",  # 82-ru: 'Какое украшение не упоминается в тексте?'
    r"Определите\s+стиль\s+и\s",  # 82-ru: 'Определите стиль и тип речи. Научный, рассуждени'
    r"Піскен\s+егінді\s+кім\s",  # 35-kk: 'Піскен егінді кім жинап алады?'
    r"Мəтінге\s+тəн\s+стиль\s",  # 35-kk: 'Мəтінге тəн стиль түрі:'
    r"Бірінші\s+көрме\s+мен\s",  # 50-kk: 'Бірінші көрме мен екінші көрменің айырмашылығы'
    r"Мəтінде\s+не\s+туралы\s",  # 50-kk: 'Мəтінде не туралы айтылған?'
    r"Содан\s+«жау\s+шапты»\s",  # 50-kk: 'Содан «жау шапты» деген хабарды естіп, Бəйдібек '
    r"Вопрос\s+на\s+который\s",  # 82-ru: 'Вопрос, на который можно ответить по содержанию '
    r"Ситуация\s+в\s+случае\s",  # 82-ru: 'Ситуация в случае закрытия фонтана не реконструк'
    r"Лихачеву\s+Тип\s+речи\s",  # 82-ru: 'Лихачеву) Тип речи'
    r"Түлкі\s+неге\s+қашып\s",  # 35-kk: 'Түлкі неге қашып кетеді?'
    r"Ахмет\s+Яссауи\s+қай\s",  # 50-kk: 'Ахмет Яссауи қай ғасырда өмір сүрген?'
    r"Кіші\s+жүзде\s+билік\s",  # 50-kk: 'Кіші жүзде билік үшін күрес шиеленіскен кезең'
    r"в\s+соответствии\s+с\s",  # 82-ru: 'в соответствии с текстом)'
    r"Что\s+такое\s+Ольхон\??",  # 82-ru: после слова сразу «?», без пробела
    r"Жарыс\s+қазан\s+асу\s",  # 35-kk: 'Жарыс қазан асу кезінде қандай тағам əзірленеді?'
    r"Абзац\s+в\s+котором\s",  # 82-ru: 'Абзац, в котором содержится информация о приобще'
    r"Но\s+особое\s+место\s",  # 82-ru: 'Но особое место в сердце писателя занял велосипе'
    r"Аннотация\s+–\s+это\s",  # 82-ru: 'Аннотация – это'
    r"Из\s+какого\s+языка\s",  # 82-ru: 'Из какого языка пришло слово «офшор»?'
    r"В\s+каком\s+абзаце\s",  # 19-ru: 'В каком абзаце встречаются слова, имеющие уменьш'
    r"Жігіт\s+пен\s+қарт\s",  # 35-kk: 'Жігіт пен қарт не затқа бəстесті?'
    r"Озаглавьте\s+текст\s",  # 82-ru: 'Озаглавьте текст.'
    r"Автора\s+в\s+людях\s",  # 82-ru: 'Автора в людях восхищает'
    r"Автор\s+уловил\s+в\s",  # 82-ru: 'Автор уловил в осеннем воздухе запах'
    r"Укажите\s+что\s+из\s",  # 82-ru: 'Укажите, что из перечисленного не характерно для'
    r"Жазушының\s+əкесі\s",  # 50-kk: 'Жазушының əкесі'
    r"Тек\s+бұнын\s+тек\s",  # 50-kk: 'Тек бұнын, тек мынау талайды көріп, талай тауға '
    r"Фонтан\s+в\s+Риме\s",  # 82-ru: 'Фонтан в Риме стоит на месте'
    r"Баритон\s+–\s+это\s",  # 82-ru: 'Баритон – это'
    r"За\s+год\s+ягель\s",  # 19-ru: 'За год ягель вырастает'
    r"Мəтіннің\s+стилі\s",  # 50-kk: 'Мəтіннің стилі'
    r"Ягель\s+–\s+это\s",  # 19-ru: 'Ягель – это'
    r"Ягель\s+–\s+бұл\s",  # 19-kk: 'Ягель – бұл:'
    r"В\s+тексте\s+не\s",  # 82-ru: 'В тексте не упоминается ученый'
    r"В\s+3\s+абзаце\s",  # 82-ru: 'В 3 абзаце содержится информация о (об)'
    r"Тема\s+текста\s",  # 82-ru: 'Тема текста'
]
_STARTER_RES = [re.compile(p, re.IGNORECASE) for p in QUESTION_STARTERS]

# «(320 слов)», «(153 слова)», «(241 слово)» — задание после скобки
_WORDCOUNT_SLUG = re.compile(
    r"\(\d+\s+(?:слов|слово|слова)\)\s*",
    re.IGNORECASE,
)

# Как splitReadingStem: «. » + фраза задания; длинные раньше (последний rfind в _fallback_needles).
NEEDLES_AFTER_DOT: tuple[str, ...] = tuple(
    sorted(
        (
            # Қазақша
            "Жетіспейтін сөзді табыңыз",
            "Мəтін мазмұнынан алшақ ойды табыңыз",
            "Мəтіннің соңғы бөлігінде айтылған ойды табыңыз",
            "Мəтіннің соңғы бөлігінде айтылған ой",
            "Мəтінде эндемикалық өсімдіктер қатарына жататын түрді көрсетіңіз",
            "Мəтінде Бейбарыс сұлтанға қатысты не айтылмады",
            "Мəтін бойынша дəрілік өсімдіктердің басты ерекшелігі",
            "Мəтінге тəн стиль түрі",
            "Мəтіннен шығатын қорытынды",
            "Мəтінге қайшы тұжырым",
            "Мәтінге қайшы тұжырым",
            "Мəтінге лайық тақырып",
            "Мəтінге сəйкес",
            "Мəтінге ",
            "Мәтінге ",
            # Орысский
            "Утверждение, противоречащее тексту",
            "Пропущенное слово в ряду",
            "В каком абзаце встречаются",
            "В каком абзаце",
            "Согласно тексту,",
            "Согласно тексту ",
            "О влиянии плавания",
            "Сколько калорий",
            "Что изначально обозначал",
            "Что из перечисленного",
            "Какое из утверждений",
            "Какая из причин",
            "Определите стиль текста",
            "Определите тип речи",
            "Укажите неверное утверждение",
            "Выберите неверное утверждение",
            "Укажите верные параметры",
            "Укажите верное утверждение",
            "Укажите неверное",
            "Учебными принадлежностями",
            "Укажите ",
            "Найдите ",
            "Выберите ",
            "Определите ",
            "Төменгі тұжырымдардың қайсысы дұрыс?",
            "Бірінші көрме мен екінші көрменің айырмашылығы",
            "Халықтың Құлагерге деген ерекше құрметі суреттелетін азатжол",
            "Барлық жүлдегерлерге ортақ тігілген бағалы сый",
            "Абай шешімінің өзгеру себебі",
        ),
        key=len,
        reverse=True,
    ),
)

_MAX_PROMPT_LEN = 520
_MIN_PASSAGE_REST = 38  # согласовано с packages/shared MIN_PASSAGE_LEN по «rest» после заголовка


def normalize_pdf_text(text: str) -> str:
    text = text.replace("\xa0", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n+", " ", text)
    text = re.sub(r" +", " ", text)
    return text.strip()


def split_numbered_blocks(text: str) -> list[tuple[int, str]]:
    text = normalize_pdf_text(text)
    matches = list(
        re.finditer(r"(?<!\()(?<![0-9])([1-9][0-9]{0,2})\)\s", text),
    )
    out: list[tuple[int, str]] = []
    for i, m in enumerate(matches):
        n = int(m.group(1))
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(text)
        body = text[start:end].strip()
        out.append((n, body))
    return out


def parse_options_segment(opt_text: str) -> Optional[dict[str, str]]:
    opts: dict[str, str] = {}
    for m in OPTION_CHUNK.finditer(opt_text.strip()):
        letter = m.group(1).upper()
        opts[letter] = m.group(2).strip()
    if set(opts.keys()) != {"A", "B", "C", "D"}:
        return None
    return opts


def parse_single_lang_block(body: str) -> Optional[dict[str, Any]]:
    body = body.strip()
    letter, before = split_answer_suffix(body)
    if not letter:
        return None
    fm = FIRST_OPTION.search(before)
    if not fm:
        return None
    letter_pos = fm.start(1)
    stem = before[:letter_pos].strip()
    opt_text = before[letter_pos:].strip()
    opts = parse_options_segment(opt_text)
    if not opts or letter not in opts:
        return None
    return {"stem": stem, "options": opts, "correct": letter}


def parse_file(path: Path) -> dict[int, dict[str, Any]]:
    raw = path.read_text(encoding="utf-8")
    out: dict[int, dict[str, Any]] = {}
    for n, body in split_numbered_blocks(raw):
        p = parse_single_lang_block(body)
        if p:
            out[n] = p
    return out


def _find_question_split(rest: str) -> Optional[int]:
    """Самое раннее совпадение — для enrich_carry_passages (подстановка длинного мәтін)."""
    best: Optional[int] = None
    for rx in _STARTER_RES:
        m = rx.search(rest)
        if m:
            if best is None or m.start() < best:
                best = m.start()
    return best


def _split_position_plausible(rest: str, pos: int) -> bool:
    """Отсекаем стартёр внутри фразы: «…сородичам» + «информацию…», «…өңіржиекті» + «мереке…»."""
    pb = rest[:pos].rstrip()
    q = rest[pos:].strip()
    if len(q) < 4:
        return False
    rlen = len(rest)
    if rlen and len(q) > max(_MAX_PROMPT_LEN, int(0.48 * rlen)):
        if not _looks_like_question_tail(q):
            return False
    if pb and pb[-1].isalpha() and q and q[0].islower():
        return False
    return True


def _pick_last_plausible_starter_split(rest: str, *, min_passage: int) -> Optional[int]:
    """Самое позднее из стартёров, но не разрыв середины предложения (см. _split_position_plausible)."""
    candidates: list[int] = []
    for rx in _STARTER_RES:
        for m in rx.finditer(rest):
            st = m.start()
            if st >= min_passage:
                candidates.append(st)
    for pos in sorted(set(candidates), reverse=True):
        if _split_position_plausible(rest, pos):
            return pos
    return None


def _fix_missing_space_after_period(s: str) -> str:
    """«утверждение.В конкурсной» → «утверждение. В конкурсной» — иначе стартеры не матчятся."""
    return re.sub(r"([.!?])([А-ЯЁA-ZӘҢҒҚҮҰІӨҺ])", r"\1 \2", s)


def _looks_like_question_tail(t: str) -> bool:
    """Как looksLikeQuestionTail в @bilimland/shared — хвост похож на задание, не на абзац мәтін."""
    s = t.strip()
    if len(s) < 6 or len(s) > _MAX_PROMPT_LEN:
        return False
    if s.endswith("?"):
        return True
    prefixes = (
        "Укажите",
        "Найдите",
        "Выберите",
        "Определите",
        "Согласно тексту",
        "В каком абзаце",
        "Пропущенное слово",
        "Утверждение,",
        "Сколько калорий",
        "О влиянии",
        "Что из",
        "Какое из",
        "Какая из",
        "Какой из",
        "Учебными принадлежностями",
        "Тема текста",
        "Информация, не соответствующая",
        "Информация о Марке",
        "Вопрос, на который",
        "Действие рассказа",
        "Наивысшей ценностью",
        "Рассказчик предполагает",
        "Чувства, испытанные",
        "Мəтінге",
        "Мәтінге",
        "Жетіспейтін",
        "Мəтін бойынша",
        "Мəтіннің стилін",
        "Мəтін мазмұнына",
        "Мəтінде жауабы",
        "Қате тұжырымды",
        "Дұрыс тұжырымды",
        "Автор қай",
        "Тұжырымдардың дұрысы",
        "Бірінші азатжолдағы",
        "Мəтін бойынша қазақ",
        "Үрмелі музыкалық",
        "Үрмелі аспаптың",
        "Керней аспабының",
        "Жазушының əкесі",
        "Жазушының",
        "Төреқұл Айтматовтың",
        "Лениндік сыйлық",
        "«Жəмилə» повесі",
        "Қазақтың ерекше ырымы",
        "Қазақтың ерекше ырым",
        "Келін үйдің",
        "Қырқынан шығару",
        "Мереке күндері",
        "Киімді сəндеу",
        "Қыздың ұзатылуы",
        "Қыш-құмыра өндіру",
        "Мəтіндегі Үркер",
        "Автордың жұлдыздар",
        "Халықтың:",
        "Бірінші көрмеге",
        "Мəтін мазмұнына сай",
        "реттілігін анықтаңыз",
        "Ягель бір жылда",
        "За год ягель",
        "Аннотация",
        "Мəтіннің стилі",
        "Халықтың Құлагерге",
        "Барлық жүлдегерлерге",
        "Абай шешімінің өзгеру",
        "Примета туристов",
        "Фонтан в Риме стоит",
        "Ситуация в случае",
        "Информация, соответствующая",
        "Статус казахского",
        "Баритон",
        "В данном контексте",
    )
    if any(s.startswith(p) for p in prefixes):
        return True
    if len(s) <= 120 and re.search(
        r"таңдаңыз:|табыңыз:|анықтаңыз:|көрсетіңіз:",
        s,
    ):
        return True
    return False


def _fallback_needles(rest: str, min_passage: int) -> Optional[tuple[str, str]]:
    for needle in NEEDLES_AFTER_DOT:
        marker = ". " + needle
        hit = rest.rfind(marker)
        if hit < min_passage:
            continue
        passage_body = rest[: hit + 1].rstrip()
        question = rest[hit + 2 :].strip()
        if len(question) < 4:
            continue
        return passage_body, question
    return None


def _fallback_question_mark(rest: str, min_passage: int) -> Optional[tuple[str, str]]:
    r = rest.strip()
    if not r.endswith("?"):
        return None
    before = r[:-1]
    last_dot = before.rfind(". ")
    if last_dot < min_passage:
        return None
    question = r[last_dot + 2 :].strip()
    if not (8 <= len(question) <= _MAX_PROMPT_LEN):
        return None
    passage_body = r[: last_dot + 1].strip()
    return passage_body, question


def _fallback_after_wordcount_paren(rest: str, min_passage: int) -> Optional[tuple[str, str]]:
    last: Optional[re.Match[str]] = None
    for m in _WORDCOUNT_SLUG.finditer(rest):
        last = m
    if last is None:
        return None
    pos = last.end()
    if pos < min_passage:
        return None
    passage_body = rest[:pos].rstrip()
    question = rest[pos:].strip()
    if len(question) < 4:
        return None
    return passage_body, question


def _fallback_q_then_numbered_list(rest: str, min_passage: int) -> Optional[tuple[str, str]]:
    """«…дұрыс? 1. … 2. …» — сұрақ жолы + нумераланған тізім бөлінеді."""
    m = re.search(r"\?\s+1\.\s", rest)
    if not m:
        return None
    q_end = m.start() + 1
    if q_end < min_passage:
        return None
    passage_body = rest[:q_end].rstrip()
    question = rest[m.end() :].strip()
    if len(question) < 6:
        return None
    return passage_body, question


def _fallback_sentence_breaks(rest: str, min_passage: int) -> Optional[tuple[str, str]]:
    """Қазақша «! » / «? » — splitReadingStem splitByTrailingSegments тәрізді."""
    for m in reversed(list(re.finditer(r"(?<=[.!?])\s+", rest))):
        pos = m.end()
        if pos < min_passage:
            break
        passage_body = rest[:pos].rstrip()
        question = rest[pos:].strip()
        if not question:
            continue
        if _looks_like_question_tail(question):
            return passage_body, question
    return None


def _fallback_trailing_dot_segments(rest: str, min_passage: int) -> Optional[tuple[str, str]]:
    parts = rest.split(". ")
    if len(parts) < 2:
        return None
    for n in range(1, min(14, len(parts))):
        head_parts = parts[:-n]
        tail_parts = parts[-n:]
        head = ". ".join(head_parts)
        tail = ". ".join(tail_parts).strip()
        if len(head) < min_passage:
            break
        if not _looks_like_question_tail(tail):
            continue
        passage_body = head if head.endswith((".", "!", "?")) else f"{head}."
        return passage_body.rstrip(), tail
    return None


def _fallback_last_period_short_tail(rest: str, min_passage: int) -> Optional[tuple[str, str]]:
    """Соңғы қысқа сөйлем — OCR үзілген немесе танымал стартерсіз сұрақ."""
    idx = rest.rfind(". ")
    while idx >= min_passage:
        passage_body = rest[: idx + 1].rstrip()
        question = rest[idx + 2 :].strip()
        tl = len(question)
        if 10 <= tl <= 260 and "(1)" not in question and "(2)" not in question:
            return passage_body, question
        idx = rest.rfind(". ", 0, idx)
    return None


def _kk_rest_long_enough_for_own_passage(kk: str) -> bool:
    s = _fix_missing_space_after_period(kk.strip())
    m = TEXT_HEAD.match(s)
    if not m:
        return False
    body = (m.group(3) or "").strip()
    return len(body) >= 120


def extract_passage_question_from_stem(
    stem: str,
    *,
    min_passage: int = 20,
) -> Optional[tuple[str, str]]:
    """
    passage = «Текст N / Мәтін N …», question = формулировка задания.
    Сначала стартеры (последнее совпадение), затем те же приёмы, что в splitReadingStem.
    """
    s = _fix_missing_space_after_period(stem.strip())
    m = TEXT_HEAD.match(s)
    if not m:
        return None
    label = m.group(1)
    tid = int(m.group(2))
    rest = (m.group(3) or "").strip()
    if not rest:
        return None

    mp = max(min_passage, _MIN_PASSAGE_REST)
    passage_body: Optional[str] = None
    question: Optional[str] = None

    pos = _pick_last_plausible_starter_split(rest, min_passage=mp)
    if pos is not None:
        pb = rest[:pos].rstrip()
        qn = rest[pos:].strip()
        if pb and qn:
            passage_body, question = pb, qn

    if passage_body is None:
        fb = _fallback_needles(rest, mp)
        if fb is None:
            fb = _fallback_question_mark(rest, mp)
        if fb is None:
            fb = _fallback_after_wordcount_paren(rest, mp)
        if fb is None:
            fb = _fallback_q_then_numbered_list(rest, mp)
        if fb is None:
            fb = _fallback_sentence_breaks(rest, mp)
        if fb is None:
            fb = _fallback_trailing_dot_segments(rest, mp)
        if fb is None:
            fb = _fallback_last_period_short_tail(rest, mp)
        if fb:
            passage_body, question = fb

    if not passage_body or not question:
        return None
    full_passage = f"{label} {tid} {passage_body}".strip()
    return (full_passage, question)


def attach_passage_question_hints(row: dict[str, Any]) -> None:
    """Добавляет passageRu/questionRu (и Kk) — сидер без splitReadingStem."""
    ru = row.get("stemRu")
    if isinstance(ru, str):
        ex = extract_passage_question_from_stem(ru)
        if ex:
            row["passageRu"], row["questionRu"] = ex
    kk = row.get("stemKk")
    if isinstance(kk, str) and kk != ru:
        exk = extract_passage_question_from_stem(kk)
        if exk:
            row["passageKk"], row["questionKk"] = exk
        elif "passageRu" in row and not _kk_rest_long_enough_for_own_passage(kk):
            # merge bank-19: KK — только сұрақ, мәтін тек RU блокта
            row["passageKk"], row["questionKk"] = row["passageRu"], kk.strip()
    elif isinstance(kk, str) and kk == ru and "passageRu" in row:
        row["passageKk"], row["questionKk"] = row["passageRu"], row["questionRu"]


def enrich_carry_passages(items: dict[int, dict[str, Any]], min_passage_len: int = 50) -> None:
    """Для каждого номера мәтін/текст запоминает основной абзац и подставляет к коротким вопросам."""
    passages: dict[int, str] = {}

    for n in sorted(items.keys()):
        stem = items[n]["stem"]
        m = TEXT_HEAD.match(stem.strip())
        if not m:
            continue

        label = m.group(1)
        tid = int(m.group(2))
        rest = (m.group(3) or "").strip()
        pos = _find_question_split(rest)

        if pos is not None and pos >= min_passage_len:
            passage = rest[:pos].strip()
            question = rest[pos:].strip()
            if len(passage) >= min_passage_len:
                passages[tid] = passage
            items[n]["stem"] = f"{label} {tid} {passage} {question}".strip()
        elif pos is not None and pos < min_passage_len:
            question = rest
            cached = passages.get(tid, "")
            if cached:
                items[n]["stem"] = f"{label} {tid} {cached} {question}".strip()
        else:
            cached = passages.get(tid, "")
            if cached and len(rest) <= 220:
                items[n]["stem"] = f"{label} {tid} {cached} {rest}".strip()
            elif len(rest) >= min_passage_len and not cached:
                passages[tid] = rest


def merge_banks(
    ru: dict[int, dict],
    kk: dict[int, dict],
    correct_overrides: Optional[dict[int, str]] = None,
) -> list[dict[str, Any]]:
    correct_overrides = correct_overrides or {}
    nums = sorted(set(ru.keys()) & set(kk.keys()))
    merged: list[dict[str, Any]] = []
    for n in nums:
        r, k = ru[n], kk[n]
        letter = correct_overrides.get(n, r["correct"])
        if letter not in r["options"]:
            letter = r["correct"]
        merged.append(
            {
                "n": n,
                "stemRu": r["stem"],
                "stemKk": k["stem"],
                "optionsRu": r["options"],
                "optionsKk": k["options"],
                "correct": letter,
            }
        )
    return merged


def single_lang_to_questions(items: dict[int, dict], *, kk_primary: bool) -> list[dict[str, Any]]:
    loc = "kk" if kk_primary else "ru"
    merged: list[dict[str, Any]] = []
    for n in sorted(items.keys()):
        q = items[n]
        stem = q["stem"]
        opts = q["options"]
        merged.append(
            {
                "n": n,
                "stemRu": stem,
                "stemKk": stem,
                "optionsRu": opts,
                "optionsKk": opts,
                "correct": q["correct"],
                "contentLocale": loc,
            }
        )
    return merged


# Сквозная нумерация: (bank_id, локальный_номер_текста) → глобальный
TEXT_NUM_IN_STEM = re.compile(
    r"(М(?:(?:ә|е|\u0259|і|i)тін)|Текст)\s+(\d+)\b",
    re.IGNORECASE,
)


class GlobalTextRenumber:
    def __init__(self) -> None:
        self.next_id = 1
        self.seen: dict[tuple[str, int], int] = {}

    def renumber(self, stem: str, bank_id: str) -> str:
        def repl(m: re.Match[str]) -> str:
            label = m.group(1)
            loc = int(m.group(2))
            key = (bank_id, loc)
            if key not in self.seen:
                self.seen[key] = self.next_id
                self.next_id += 1
            return f"{label} {self.seen[key]}"

        return TEXT_NUM_IN_STEM.sub(repl, stem)

    def apply_bank(self, bank: dict[str, Any]) -> None:
        bid = bank["id"]
        for q in bank["questions"]:
            q["stemRu"] = self.renumber(q["stemRu"], bid)
            q["stemKk"] = self.renumber(q["stemKk"], bid)


def main() -> None:
    if not READING_DIR.is_dir():
        raise SystemExit(f"Missing {READING_DIR}")

    banks_spec: list[dict[str, Any]] = [
        {
            "id": "bank-19",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 19 сұрақ (PDF)",
                "ru": "ЕНТ · Грамотность чтения · банк 19 (PDF)",
                "en": "ENT · Reading literacy · 19 (PDF)",
            },
            "mode": "merge",
            "ru": READING_DIR / "reading-19-ru.txt",
            "kk": READING_DIR / "reading-19-kk.txt",
            "overrides": {},
        },
        {
            "id": "bank-35-kk",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 35 сұрақ (PDF, KK)",
                "ru": "ЕНТ · Грамотность чтения · банк 35 (PDF, KK)",
                "en": "ENT · Reading literacy · 35 (PDF, KK)",
            },
            "mode": "single",
            "kk_primary": True,
            "path": READING_DIR / "reading-35-kk.txt",
        },
        {
            "id": "bank-50-kk",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 50 сұрақ (PDF, KK)",
                "ru": "ЕНТ · Грамотность чтения · банк 50 (PDF, KK)",
                "en": "ENT · Reading literacy · 50 (PDF, KK)",
            },
            "mode": "single",
            "kk_primary": True,
            "path": READING_DIR / "reading-50-kk.txt",
        },
        {
            "id": "bank-82-ru",
            "label": {
                "kk": "ЕНТ · Оқу сауаттылығы · 82 сұрақ (PDF, RU)",
                "ru": "ЕНТ · Грамотность чтения · банк 82 (PDF, RU)",
                "en": "ENT · Reading literacy · 82 (PDF, RU)",
            },
            "mode": "single",
            "kk_primary": False,
            "path": READING_DIR / "reading-82-ru.txt",
        },
    ]

    all_banks: list[dict[str, Any]] = []
    for b in banks_spec:
        if b["mode"] == "merge":
            ru_p = b["ru"]
            kk_p = b["kk"]
            if not ru_p.exists() or not kk_p.exists():
                print("SKIP merge (missing file):", b["id"], ru_p.exists(), kk_p.exists())
                continue
            ru = parse_file(ru_p)
            kk = parse_file(kk_p)
            enrich_carry_passages(ru)
            enrich_carry_passages(kk)
            questions = merge_banks(ru, kk, b.get("overrides"))
            all_banks.append({"id": b["id"], "label": b["label"], "questions": questions})
            print(b["id"], "questions:", len(questions), "ru", len(ru), "kk", len(kk))
        else:
            p = b["path"]
            if not p.exists():
                print("SKIP single (missing file):", b["id"])
                continue
            items = parse_file(p)
            enrich_carry_passages(items)
            questions = single_lang_to_questions(items, kk_primary=b["kk_primary"])
            all_banks.append({"id": b["id"], "label": b["label"], "questions": questions})
            print(b["id"], "questions:", len(questions), "parsed keys", len(items))

    renum = GlobalTextRenumber()
    for bank in all_banks:
        renum.apply_bank(bank)
    print("Global text markers: assigned", renum.next_id - 1, "distinct text numbers")

    for bank in all_banks:
        for q in bank["questions"]:
            attach_passage_question_hints(q)

    OUT.write_text(json.dumps(all_banks, ensure_ascii=False, indent=2), encoding="utf-8")
    print("Wrote", OUT)


if __name__ == "__main__":
    main()
