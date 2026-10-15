<?php

namespace App\Http\Controllers;

use App\Models\Product;
use Illuminate\Http\Request;

class ProductController extends Controller
{
    public function index()
    {
        return response()->json(Product::orderBy('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:500'],
            'price' => ['required', 'numeric', 'min:0', 'max:99999'],
            'stock' => ['required', 'integer', 'min:0', 'max:100000'],
            'from' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'to' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
        ]);

        $product = Product::create(array_filter($data, fn ($v) => $v !== null));

        return response()->json($product, 201);
    }
}