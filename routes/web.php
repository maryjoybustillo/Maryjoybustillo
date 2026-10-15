<?php

use App\Http\Controllers\OrderController;
use App\Http\Controllers\ProductController;
use App\Http\Controllers\ProfileController;
use App\Models\Order;
use App\Models\Product;
use Illuminate\Foundation\Application;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Pages (React files in resources/js/Pages)
|--------------------------------------------------------------------------
*/

Route::get('/', function () {
    return Inertia::render('Welcome', [
        'canLogin' => Route::has('login'),
        'canRegister' => Route::has('register'),
        'laravelVersion' => Application::VERSION,
        'phpVersion' => PHP_VERSION,
    ]);
});

// resources/js/Pages/Products/page.jsx
Route::get('/products', function () {
    return Inertia::render('Products/page');
})->name('products');

// resources/js/Pages/Dashboard.jsx
Route::get('/dashboard', function () {
    return Inertia::render('Dashboard');
})->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

/*
|--------------------------------------------------------------------------
| Data routes used by the React pages
|--------------------------------------------------------------------------
*/

Route::get('/api/products', [ProductController::class, 'index']);

Route::middleware(['auth', 'verified'])->group(function () {
    Route::post('/api/products', [ProductController::class, 'store']);
    Route::post('/api/orders', [OrderController::class, 'store']);
    Route::patch('/api/orders/{order}', [OrderController::class, 'update']);
    Route::delete('/api/orders/{order}', [OrderController::class, 'destroy']);

    Route::get('/api/dashboard', function () {
        // Sales for each of the last 7 days (cancelled orders excluded)
        $weeklySales = collect(range(6, 0))->map(function ($daysAgo) {
            $date = now()->subDays($daysAgo);

            return [
                'day' => $date->format('D'),
                'total' => (float) Order::whereDate('created_at', $date)
                    ->where('status', '!=', 'Cancelled')
                    ->sum('total'),
            ];
        })->values();

        return response()->json([
            'weeklySales' => $weeklySales,
            'orders' => Order::latest()->take(20)->get(['id', 'customer', 'items', 'total', 'status']),
            'products' => Product::orderBy('stock')->take(8)->get(['id', 'name', 'stock']),
            'customers' => Order::distinct('customer')->count('customer'),
        ]);
    });
});

require __DIR__.'/auth.php';