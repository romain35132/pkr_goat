IMAGE_NAME = pkr-goat
CONTAINER_NAME = pkr-goat-container
PORT = 3000

.PHONY: start stop build logs

build:
	docker-compose build

start: stop
	docker-compose up -d
	@echo "L'application a démarré sur http://localhost:$(PORT)"

stop:
	docker-compose down
	@echo "L'application a été arrêtée."

logs:
	docker-compose logs -f
