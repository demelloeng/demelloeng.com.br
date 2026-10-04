import assert from 'node:assert/strict';
import test from 'node:test';
import {routeFromSearch,initialState} from '../src/deeplink.mjs';
import {starts,routes} from '../src/journey.mjs';

test('deep-link: cada rota da jornada abre no seu primeiro nó', () => {
  for (const route of Object.keys(routes)) {
    assert.equal(routeFromSearch(`?situacao=${route}`), route);
    const s = initialState(`?situacao=${route}`);
    assert.equal(s.id, starts[route]);
    assert.equal(s.answers.route, route);
    assert.deepEqual(s.history, ['HOME'], 'Voltar leva à escolha de situação');
  }
});

test('deep-link: valor ausente ou desconhecido mantém o HOME', () => {
  for (const q of ['', '?', '?situacao=', '?situacao=construir', '?situacao=__proto__', '?situacao=toString', '?x=build']) {
    assert.equal(routeFromSearch(q), null, q);
    assert.deepEqual(initialState(q), {id:'HOME',answers:{},history:[]}, q);
  }
});
