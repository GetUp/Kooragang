#!/bin/sh

host="ec2-34-205-126-179.compute-1.amazonaws.com"
database="d5vp9bs7fjegc2"
user="ub926g4v0fta4f"

[ -z "$1" ] && echo "Usage: ./import_to_prod.sh /absolute/path/to/table_name.csv" && exit 1

path="$1"
filename=$(basename "$1")
tablename=$(echo "${filename%.*}" | tr '[:upper:]' '[:lower:]')

read -p "is '$tablename' the desired table name? [yN]" -n 1 -r; echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then [[ "$0" = "$BASH_SOURCE" ]] && exit 1 || return 1; fi

create=$(csvsql -i postgresql $path 2>/dev/null | tr '[:upper:]' '[:lower:]' | sed -E 's/table \"/table sources."/' | awk '!(NR%2){gsub(FS,"_")}1' RS=\" ORS= | sed -E 's/varchar\([[:digit:]]+\)|decimal/text/g')

echo "CREATING TABLE USING:"
echo $create
psql -c "$create" -h $host -d $database -U $user
echo
echo "IMPORTING TO sources.$tablename"
psql -c "\copy sources.$tablename FROM '$path' header csv;" -h $host -d $database -U $user
echo "DONE!"
