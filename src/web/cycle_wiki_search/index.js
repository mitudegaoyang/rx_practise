import Cycle from '@cycle/core'
import CycleJSONP from '@cycle/jsonp'
import {makeDOMDriver, hJSX, div, input, p} from '@cycle/dom'
import Rx from 'rx'
import searchBox from './searchbox'

const MAIN_URL = 'https://en.wikipedia.org'
const WIKI_URL = MAIN_URL + '/wiki/'
const API_URL = MAIN_URL + '/w/api.php?action=query&list=search&format=json&srsearch='

function main(responses) {
  const wpSearchBox = searchBox({
    DOM: responses.DOM,
    props$: Rx.Observable.just({
      apiUrl: API_URL
    })
  })
  const searchDOM$ = wpSearchBox.DOMTree
  const searchResult$ = responses.JSONP
    .filter(res$ => res$.request.indexOf(API_URL) === 0)
    .concatAll()
    .pluck('query', 'search')
    .startWith([])

  return {
    DOM: Rx.Observable.combineLatest(
      searchDOM$, searchResult$, (tree, links) => {
        links = links.map(result => {
          var link = WIKI_URL + result.title;
          return <div><a href={link}>{result.title}</a></div>
        })
        return (
          <div>
            <h1>Wikipedia Search</h1>
            {tree}
            <hr />
            <div>
              {links}
            </div>
          </div>
        )
      }),
    JSONP: wpSearchBox.JSONPQuery
  }
}

Cycle.run(main, {
  DOM: makeDOMDriver('#container'),
  JSONP: CycleJSONP.makeJSONPDriver()
})

