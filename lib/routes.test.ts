import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isProtectedRoute, isAuthRoute, isSafeRedirectTarget } from './routes';

test('isProtectedRoute: защищённые пути', () => {
  assert.equal(isProtectedRoute('/map'), true);
  assert.equal(isProtectedRoute('/map/123'), true);
  assert.equal(isProtectedRoute('/admin/users'), true);
  assert.equal(isProtectedRoute('/boreholes'), true);
  assert.equal(isProtectedRoute('/boreholes/uuid-1'), true);
  assert.equal(isProtectedRoute('/observation-points/uuid-1/edit'), true);
  assert.equal(isProtectedRoute('/login'), false);
  assert.equal(isProtectedRoute('/'), false);
  // Не должен ловить префиксные совпадения по случайности (например /mapx или /boreholesXYZ).
  assert.equal(isProtectedRoute('/mapx'), false);
  assert.equal(isProtectedRoute('/boreholesXYZ'), false);
});

test('isAuthRoute: страницы аутентификации', () => {
  assert.equal(isAuthRoute('/login'), true);
  assert.equal(isAuthRoute('/register'), true);
  assert.equal(isAuthRoute('/map'), false);
});

test('isSafeRedirectTarget: блокирует open redirect', () => {
  assert.equal(isSafeRedirectTarget('/map'), true);
  assert.equal(isSafeRedirectTarget('/admin/users'), true);
  assert.equal(isSafeRedirectTarget(null), false);
  assert.equal(isSafeRedirectTarget(undefined), false);
  assert.equal(isSafeRedirectTarget(''), false);
  assert.equal(isSafeRedirectTarget('map'), false); // без ведущего слэша
  assert.equal(isSafeRedirectTarget('//evil.com'), false); // протокол-относительный
  assert.equal(isSafeRedirectTarget('http://evil.com'), false);
  assert.equal(isSafeRedirectTarget('javascript:alert(1)'), false);
});
