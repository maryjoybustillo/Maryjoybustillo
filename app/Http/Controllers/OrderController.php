<?php

namespace App\Http\Controllers;

use App\Models\Order;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class OrderController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'customer' => ['required', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:99'],
        ]);

        // The total is calculated here from the database prices, never from the browser.
        $order = DB::transaction(function () use ($data) {
            $total = 0;
            $count = 0;

            foreach ($data['items'] as $line) {
                $product = Product::lockForUpdate()->findOrFail($line['id']);

                if ($product->stock < $line['qty']) {
                    abort(422, "Not enough stock for {$product->name}.");
                }

                $product->decrement('stock', $line['qty']);
                $total += $product->price * $line['qty'];
                $count += $line['qty'];
            }

            return Order::create([
                'customer' => $data['customer'],
                'items' => $count,
                'total' => $total,
                'status' => 'Pending',
            ]);
        });

        return response()->json($order, 201);
    }

    public function update(Request $request, Order $order)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Pending', 'Brewing', 'Ready', 'Completed', 'Cancelled'])],
        ]);

        $order->update($data);

        return response()->json($order);
    }

    public function destroy(Order $order)
    {
        $order->delete();

        return response()->noContent();
    }
}