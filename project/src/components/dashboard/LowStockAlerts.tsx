import React from 'react';
import { Link } from 'react-router-dom';
import { PackageCheckIcon, TriangleAlertIcon } from 'lucide-react';
import type { Product } from '../../types';
import { Badge, EmptyState, Panel, PanelHeader } from '../ui/Primitives';
import { money } from '../../utils/format';

export function LowStockAlerts({ products }: {products: Product[];}) {
  return (
    <Panel>
      <PanelHeader
        title="Alertes de stock"
        subtitle={
        products.length > 0 ?
        `${products.length} produit(s) au seuil minimal` :
        'Tous les stocks sont au-dessus du seuil'
        }
        action={
        <Link
          to="/produits"
          className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline">
          
            Réapprovisionner
          </Link>
        } />
      
      {products.length === 0 ?
      <EmptyState
        icon={<PackageCheckIcon className="h-5 w-5" />}
        title="Aucune alerte"
        description="Les niveaux de stock sont sains." /> :


      <ul className="divide-y divide-ink-100">
          {products.map((product) => {
          const critical = product.stock === 0;
          const missing = Math.max(0, product.minStock - product.stock) + 5;
          return (
            <li key={product.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink-900">
                      <TriangleAlertIcon
                      className={`h-4 w-4 shrink-0 ${critical ? 'text-red-500' : 'text-amber-500'}`} />
                    
                      {product.name}
                    </p>
                    <p className="mt-0.5 text-sm text-ink-500">
                      Réappro. conseillé : {missing} {product.unit} ·{' '}
                      {money(missing * product.purchasePrice)}
                    </p>
                  </div>
                  <Badge tone={critical ? 'danger' : 'warning'}>
                    {product.stock} / {product.minStock}
                  </Badge>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                  <div
                  className={`h-full rounded-full ${critical ? 'bg-red-500' : 'bg-amber-500'}`}
                  style={{
                    width: `${Math.min(100, product.minStock === 0 ? 100 : product.stock / product.minStock * 100)}%`
                  }} />
                
                </div>
              </li>);

        })}
        </ul>
      }
    </Panel>);

}