
FROM minio/mc:latest AS mc

FROM minio/minio:latest

COPY --from=mc /usr/bin/mc /usr/bin/mc

COPY init.sh /usr/local/bin/init.sh
RUN chmod +x /usr/local/bin/init.sh

ENTRYPOINT ["/usr/local/bin/init.sh"]
CMD ["server", "/data", "--console-address", ":9001"]
