IMAGE_NAME = pkr-goat
CONTAINER_NAME = pkr-goat-container
PORT = 3000

.PHONY: start stop build logs

build:
	docker build -t $(IMAGE_NAME) .

start: build stop
	docker run -d --name $(CONTAINER_NAME) -p $(PORT):3000 $(IMAGE_NAME)
	@echo "L'application a démarré sur http://localhost:$(PORT)"

stop:
	docker stop $(CONTAINER_NAME) 2>/dev/null || true
	docker rm $(CONTAINER_NAME) 2>/dev/null || true
	@echo "L'application a été arrêtée."

logs:
	docker logs -f $(CONTAINER_NAME)
