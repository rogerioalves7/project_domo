from django.contrib import admin
from .models import House, HouseMember, Account, CreditCard, Invoice, Transaction, Product, InventoryItem, ShoppingList

# Isso permite ver e editar essas tabelas em http://localhost:8000/admin
admin.site.register(House)
admin.site.register(HouseMember)
admin.site.register(Account)
admin.site.register(CreditCard)
admin.site.register(Invoice)
admin.site.register(Transaction)
admin.site.register(Product)
admin.site.register(InventoryItem)
admin.site.register(ShoppingList)