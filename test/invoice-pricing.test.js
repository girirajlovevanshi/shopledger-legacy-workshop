'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var invoice = require('../lib/invoice');
var reports = require('../lib/reports');

function recordedOrder(items, coupon) {
  var totals = pricing.computeTotals(items, coupon || '');
  return {
    id: 2001,
    date: '01/01/2026',
    customer: 'In-memory customer',
    status: 'completed',
    items: items,
    coupon: coupon || '',
    subtotal: totals.subtotal,
    discount: totals.discount,
    tax: totals.tax,
    total: totals.total
  };
}

test('invoice uses the same HSN GST and total as order pricing', function () {
  var order = recordedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.tax, 5);
  assert.equal(order.total, 105);
  assert.equal(figures.rows[0].gstPercent, 5);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.cgst, 2.5);
  assert.equal(figures.sgst, 2.5);
  assert.equal(figures.total, order.total);
});

test('invoice calculates GST after applying a flat coupon', function () {
  var order = recordedOrder([
    { id: 1, name: 'Ghee', hsn: '0405', gstRate: 5, price: 400, qty: 1 }
  ], 'FLAT50');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 50);
  assert.equal(order.tax, 17.5);
  assert.equal(order.total, 367.5);
  assert.equal(figures.discount, 50);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('invoice uses the configured percentage coupon cap', function () {
  var order = recordedOrder([
    { id: 1, name: 'Oil', hsn: '1508', gstRate: 5, price: 4000, qty: 1 }
  ], 'WHOLESALE15');
  var figures = invoice.computeInvoiceFigures(order);

  assert.equal(order.discount, 400);
  assert.equal(order.tax, 180);
  assert.equal(order.total, 3780);
  assert.equal(figures.discount, order.discount);
  assert.equal(figures.tax, order.tax);
  assert.equal(figures.total, order.total);
});

test('GST reconciliation excludes cancelled orders and matches billed figures', function () {
  var order = recordedOrder([
    { id: 1, name: 'Rice', hsn: '1006', price: 100, qty: 1 }
  ]);
  var cancelled = Object.assign({}, order, { id: 2002, status: 'cancelled' });
  var result = reports.getGstReconciliation({ orders: [order, cancelled] });

  assert.equal(result.totalChecked, 1);
  assert.equal(result.mismatchCount, 0);
  assert.equal(result.totalDelta, 0);
  assert.equal(result.rows[0].delta, 0);
  assert.equal(result.rows[0].matched, true);
});
