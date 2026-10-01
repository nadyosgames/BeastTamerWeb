import { cardTextParagraphs, keywordTextParts } from '../keywords.ts'

export function CardText({ text, paragraphs = false }: { text: string; paragraphs?: boolean }) {
  const format = (value: string) => keywordTextParts(value).map((part, i) => part.keyword ? <strong className="card__keyword" key={i}>{part.text}</strong> : part.text)
  return paragraphs ? <>{cardTextParagraphs(text).map((rule, i) => <p className="card__rule" key={i}>{format(rule)}</p>)}</> : <>{format(text)}</>
}
