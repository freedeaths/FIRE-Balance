# FIRE Balance 経済的独立計算機

包括的な経済的独立と早期退職（FIRE）計画ツールで、インタラクティブな可視化と動的計算を通じて、現実的で データ駆動型の退職計画の作成を支援します。

[English](README.md) | [中文说明](README_zh.md)

## 🎯 概要

FIRE Balance計算機は、複雑なプロセスを管理可能な段階に分解することで、FIREプランニングに対する科学的なアプローチを提供します：

1. **データ入力**：基本情報と収支予測の収集
2. **インタラクティブプランニング**：財務タイムラインの可視化と調整（過度な入力の複雑さを避けながら柔軟性を維持）
3. **分析と推奨事項**：詳細な洞察と実行可能なアドバイスの取得

### 主要機能

- **🔄 投資戦略**：設定可能なポートフォリオ戦略
- **📊 高度な可視化**：収入、支出、純資産予測のインタラクティブチャート
- **🎲 リスク分析**：モンテカルロシミュレーションと感度分析
- **🔍 履歴データ統合**：履歴純資産データからの個人ベースライン生成
- **🌍 多言語サポート**：英語、中国語、日本語
- **💡 パーソナライズされた洞察**：入力情報に基づく結論と推奨事項

## 🏗️ プロジェクト構造

このプロジェクトは複数のプログラミング言語でFIRE計算機を実装します：

- **Python実装**：包括的な計算エンジンを持つStreamlitベースのWebアプリケーション
- **React + TypeScript実装**：Tailwind CSSを使用したモダンなWebアプリケーション
- **Rust WASM実装**：現在計画されていません、計算が十分複雑ではありません

## 🚀 クイックスタート

### Pythonバージョン

#### コマンドラインインターフェース（CLI）

FIREプランを分析する最も速い方法：

```bash
# Python実装ディレクトリに移動
cd implementations/python

# デフォルトのサンプルプランで実行
python cli/fire_planner.py

# 独自のプランファイルで実行
python cli/fire_planner.py /path/to/your/plan.json

# 高速分析（少ないモンテカルロシミュレーション回数）
python cli/fire_planner.py --quick-mc

# 結果をJSONファイルに保存
python cli/fire_planner.py --output results.json
```

**CLI機能：**
- 📊 JSON設定ファイルからFIREプランを読み込み・分析
- 🎲 カスタマイズ可能なシミュレーション回数でモンテカルロリスク分析
- 💾 結果をJSON形式でエクスポート
- ⚡ 高速実行 - バッチ分析や自動化に最適

### React + TypeScriptバージョン

...

## 📖 核心概念

### 財務計画段階

1. **元の計画**：現在の収支パターンに基づく初期予測
2. **調整済み計画**：インタラクティブ編集によるユーザー修正予測
3. **年次計算**：複利収益とリバランシングを含む包括的モデリング

### リスク分析手法

- **モンテカルロシミュレーション**：ユーザー入力に基づいてランダム性とブラックスワンイベントを導入し、FIRE目標達成確率をシミュレート

## 🎨 ユーザーインターフェース

### ステージ1：基本データ入力
- 個人情報（年齢、FIRE目標、現在の資産など）
- 現在時点に基づく収入と支出の予測
- 履歴純資産データアップロード（オプション）
- 投資ポートフォリオ設定（オプション）

### ステージ2：インタラクティブプランニングボード
- リアルタイム収支チャート可視化
- ドラッグアンドドロップによる曲線調整
- 編集可能データテーブル
- 保存・読み込み機能

### ステージ3：結果ダッシュボード
- FIRE実現可能性分析
- 純資産軌道予測
- 年間純収入曲線
- パーソナライズされた推奨事項

## 🧮 計算エンジン

### 核心機能

- **インフレ調整**：全ての予測がインフレ調整済み
- **ポートフォリオリバランシング**：戦略に基づく自動リバランシング
- **複利成長**：投資収益の正確なモデリング
- **純資産/年間純収入分析**：純資産と年間純収入の詳細分析

## 📊 データ構造

### プランJSON（エクスポート/インポート）
```json
{
  "version": "1.0",
  "title": "FIRE Plan - 2026-01-23T06:25:04.196Z",
  "created_at": "2026-01-23T06:25:04.196Z",
  "user_profile": {
    "birth_year": 1985,
    "as_of_year": 2026,
    "expected_fire_age": 49,
    "legal_retirement_age": 65,
    "life_expectancy": 95,
    "current_net_worth": 3500000,
    "inflation_rate": 3,
    "safety_buffer_months": 6,
    "bridge_discount_rate": 1,
    "portfolio": {
      "asset_classes": [
        { "name": "stocks", "allocation_percentage": 20, "expected_return": 7, "volatility": 15, "liquidity_level": "medium" },
        { "name": "bonds", "allocation_percentage": 0, "expected_return": 3, "volatility": 5, "liquidity_level": "low" },
        { "name": "savings", "allocation_percentage": 0, "expected_return": 1, "volatility": 5, "liquidity_level": "low" },
        { "name": "cash", "allocation_percentage": 80, "expected_return": 1, "volatility": 1, "liquidity_level": "high" }
      ],
      "enable_rebalancing": true
    }
  },
  "income_items": [],
  "expense_items": [],
  "overrides": []
}
```

メモ：
- `as_of_year` は保存済みプランを見直す/再読み込みする際の年齢計算の基準年です。
- 安全バッファはブリッジ期間（FIRE年齢→法定退職年齢）で増減し、`bridge_discount_rate` で割引（現価換算）の強さを調整できます。

### 収支項目
```json
{
  "id": "uuid4",
  "name": "ソフトウェアエンジニア給与",
  "after_tax_amount_per_period": 80000,
  "time_unit": "annually",
  "frequency": "recurring",
  "interval_periods": 1,
  "start_age": 25,
  "end_age": 50,
  "annual_growth_rate": 5,
  "is_income": true,
  "category": "Income"
}
```

## 🌐 国際化

アプリケーションは専用の翻訳ファイルで複数言語をサポートします：

- `shared/i18n/en.json` - 英語（デフォルト）
- `shared/i18n/zh-CN.json` - 簡体字中国語
- `shared/i18n/ja.json` - 日本語

サイドバーで言語切替が可能で、ユーザー設定を永続化します。

## 🤝 貢献

...

## 📄 ライセンス

このプロジェクトはMITライセンスの下でライセンスされています - 詳細は[LICENSE](LICENSE)ファイルをご覧ください。

## 🔮 ロードマップ

...

## 📞 サポート

...

## 🙏 謝辞

...

---

**免責事項**：このツールは教育と計画目的のみです。財務アドバイスではありません。個別のガイダンスについては、資格のある財務専門家にご相談ください。
