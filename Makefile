up:
	docker compose up --build
down:
	docker compose down
logs:
	docker compose logs -f
test:
	$(MAKE) backend-test
	$(MAKE) frontend-test
backend-test:
	cd backend && pytest -q
frontend-test:
	cd frontend && npm run test -- --run
migrate:
	cd backend && python manage.py migrate
seed:
	cd backend && python manage.py seed_dev
lint:
	cd backend && ruff check .
	cd frontend && npm run lint
clean-data:
	docker compose down -v
